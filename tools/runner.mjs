// tools/runner.mjs
import cp from 'node:child_process';
import process from 'node:process';
import select from './select.mjs';

const { spawn, spawnSync } = cp;

function runEleventyBuild() {
  const outputDir = '/tmp/eleventy-build';
  console.log(`\n🏗️  Performing single Eleventy build...`);
  spawnSync('rm', ['-rf', outputDir], { stdio: 'inherit' });

  // Patch sentinel verification before any Eleventy invocation
  const verify = spawnSync(process.execPath, ['tools/verify-patch-applied.mjs'], { stdio: 'inherit' });
  if (verify.status !== 0) {
    console.error('❌ Patch verification failed; aborting build.');
    process.exit(1);
  }

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

async function main() {
  console.log('🚀 Launching test runner...');

  const allTests = await select();
  const testsToRun = allTests.map(t => t.file);
  console.log(`🔍 Found ${testsToRun.length} test files.`);

  if (testsToRun.length === 0) {
    console.log('No tests found. Exiting.');
    process.exit(0);
  }

  const sharedBuildDir = runEleventyBuild();
  console.log(`\n🧪 Running ${testsToRun.length} tests...`);

  // --- NEW: Timeout and Process Handling ---
  let testProcess;
  const timeoutMs = Number(process.env.TEST_TIMEOUT_MS || 300000); // Default to 5 minutes (300,000 ms)

  const testPromise = new Promise((resolve, reject) => {
    testProcess = spawn(process.execPath, ['--test', ...testsToRun], {
      stdio: 'inherit',
      env: { ...process.env, ELEVENTY_BUILD_DIR: sharedBuildDir },
    });
    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });
    testProcess.on('error', (err) => reject(err));
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      // This runs only if the tests take too long.
      testProcess.kill('SIGTERM'); // Terminate the stuck test process.
      reject(new Error(`Timeout: Tests took longer than ${timeoutMs / 60000} minutes.`));
    }, timeoutMs);
  });
  // --- END NEW ---

  const heartbeat = setInterval(() => {
    console.log(`// HEARTBEAT @ ${new Date().toISOString()}: Test runner is active.`);
  }, 15000);

  try {
    // Race the test process against our timeout.
    await Promise.race([testPromise, timeoutPromise]);
    console.log('\n✨ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error(`\n🔥 ${error.message}`);
    process.exit(1);
  } finally {
    clearInterval(heartbeat);
  }
}

main().catch(err => {
  console.error('A critical error occurred in the test runner:', err);
  process.exit(1);
});
