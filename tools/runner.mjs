// tools/runner.mjs
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import select from './select.mjs';

/**
 * Performs a single, shared Eleventy build for all tests.
 * The output is streamed directly to the console.
 */
function runEleventyBuild() {
  const outputDir = '/tmp/eleventy-build';
  console.log(`\n🏗️  Performing single Eleventy build...`);

  // Clean previous build
  spawnSync('rm', ['-rf', outputDir], { stdio: 'inherit' });

  // Run Eleventy build, inheriting stdio for live progress
  const result = spawnSync('npx', ['@11ty/eleventy', `--output=${outputDir}`], {
    stdio: 'inherit',
    env: { ...process.env, ELEVENTY_ENV: 'test', WATCH: '0' },
  });

  if (result.status !== 0) {
    console.error('❌ Eleventy build failed. Aborting tests.');
    process.exit(1);
  }

  console.log(`✅ Eleventy build complete.`);
  return outputDir;
}

/**
 * The main entry point for the script.
 */
function main() {
  console.log('🚀 Launching test runner...');

  // 1. Find all test files. The bootstrap script will handle smart filtering later if needed.
  const allTests = select({ all: true });
  const testsToRun = allTests.map(t => t.file);
  console.log(`🔍 Found ${testsToRun.length} test files.`);

  // 2. Build the site once.
  const sharedBuildDir = runEleventyBuild();

  // 3. Execute the tests.
  // We use spawnSync with 'inherit' because the parent `llm_run` is handling the supervision,
  // timeouts, and logging. This script's only job is to run the tests and exit with the correct code.
  console.log(`\n🧪 Running ${testsToRun.length} tests...`);
  const testResult = spawnSync(process.execPath, ['--test', ...testsToRun], {
    stdio: 'inherit',
    env: { ...process.env, ELEVENTY_BUILD_DIR: sharedBuildDir },
  });

  // 4. Exit with the result of the test run.
  if (testResult.status === 0) {
    console.log('\n✨ All tests passed!');
  } else {
    console.error('\n🔥 Tests failed.');
  }
  process.exit(testResult.status);
}

main();