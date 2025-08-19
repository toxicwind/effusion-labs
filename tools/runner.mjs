import { spawn } from 'node:child_process';
import { cpus, loadavg } from 'node:os';
import { execSync } from 'node:child_process';
import process from 'node:process';
import probe from './probe.mjs';
import select from './select.mjs';

// --- Shared Eleventy Build ---
// Performs a single Eleventy build and returns the output dir for tests to share.
async function runEleventyBuild() {
  console.log('::notice:: Performing single Eleventy build for all tests...');
  const outputDir = '/tmp/eleventy-build'; // Use a temp dir; clean it first if needed.
  try {
    execSync(`rm -rf ${outputDir}`); // Clean previous build.
    execSync(`npx @11ty/eleventy --output=${outputDir}`, { stdio: 'inherit' });
    console.log(`::notice:: Eleventy build complete. Output: ${outputDir}`);
    return outputDir;
  } catch (error) {
    console.error('::error:: Eleventy build failed. Falling back to per-test builds.', error);
    return null; // Tests will handle their own builds if this fails.
  }
}

// --- Improved Test Impact Analysis ---
// Better heuristic: partial name matching, regex for patterns, and broad impact for config/script changes.
function getImpactedTests(allTests, changedFiles) {
  if (changedFiles.length === 0) {
    console.log('::notice:: No file changes detected. Running all tests as a baseline.');
    return allTests;
  }

  console.log(`::notice:: Detected changes in: ${changedFiles.join(', ')}`);

  // Broad impact: If config/package/scripts change, run all (they affect everything).
  const broadChanges = changedFiles.some(file => 
    file.includes('package.json') || file.includes('package-lock.json') || file.includes('scripts/') || file.includes('config/')
  );
  if (broadChanges) {
    console.log('::notice:: Broad changes detected (e.g., config/scripts). Running all tests.');
    return allTests;
  }

  // Match tests to changes: partial includes, regex for variants (e.g., 'register.js' impacts 'eleventy' tests).
  const impacted = allTests.filter(test =>
    changedFiles.some(changedFile => {
      const base = changedFile.replace(/\.(js|json|sh)$/, '').toLowerCase();
      const testBase = test.file.toLowerCase();
      return testBase.includes(base) || new RegExp(base.replace(/[-\/]/g, '.*')).test(testBase);
    })
  );

  if (impacted.length > 0) {
    console.log(`::notice:: Running ${impacted.length} impacted tests based on git diff.`);
    return impacted;
  } else {
    console.log('::warning:: Could not map changes to specific tests. Running all tests.');
    return allTests;
  }
}

async function main() {
  const allFlag = process.argv.includes('--all');
  let tests = await select({ all: true });
  const caps = await probe();

  // Hoist Eleventy build (if applicable—skip if --all isn't set or for minimal runs).
  const sharedBuildDir = allFlag ? null : await runEleventyBuild();

  // Filter to impacted tests.
  let changedFiles = [];
  try {
    const diffOutput = execSync('git diff --name-only HEAD~1 HEAD').toString();
    changedFiles = diffOutput.split('\n').filter(Boolean);
  } catch {}
  if (!allFlag) {
    tests = getImpactedTests(tests, changedFiles);
  }

  const execute = [];
  const parked = [];
  for (const t of tests) {
    if (t.caps.browser && !caps.browser) {
      parked.push({ file: t.file, reason: 'browser capability absent' });
    } else {
      execute.push(t.file);
    }
  }

  if (!execute.length) {
    console.log('No tests to run.');
    if (parked.length) {
      console.log(`Parked ${parked.length} tests:`);
      parked.slice(0, 200).forEach(p => console.log(`${p.file}\t${p.reason}`));
    }
    return;
  }

  // Dynamic concurrency: Use most cores, but throttle if load is high.
  const numCores = cpus().length;
  const systemLoad = loadavg()[0]; // 1-min load average.
  let concurrency = Math.max(1, numCores - 1);
  if (systemLoad > numCores * 0.8) {
    concurrency = Math.floor(concurrency / 2); // Throttle under high load.
  }
  console.log(`::notice:: Executing ${execute.length} tests with concurrency ${concurrency} (load: ${systemLoad.toFixed(2)})...`);

  const extraImports =
    process.env.LLM_KEEPALIVE_IMPORTS ||
    '--import=./test/setup/http.mjs --import=./test/setup/llm-keepalive.mjs';
  const envNodeOptions = `${process.env.NODE_OPTIONS || ''} ${extraImports}`.trim();

  // Pass shared build dir to tests via env.
  const child = spawn(process.execPath, ['--test', `--test-concurrency=${concurrency}`, '--test-reporter=spec', ...execute], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: envNodeOptions,
      LLM_KEEPALIVE_INJECTED: '1',
      ELEVENTY_BUILD_DIR: sharedBuildDir || '', // Tests can check this and skip internal builds.
    },
    timeout: 300000, // 5-min timeout to prevent hangs.
  });

  child.on('exit', code => {
    console.log(`Executed ${execute.length} tests.`);
    if (parked.length) {
      console.log(`Parked ${parked.length} tests:`);
      parked.slice(0, 200).forEach(p => console.log(`${p.file}\t${p.reason}`));
    }
    process.exit(code);
  });

  // Keepalive emitter (from your logs—adjust interval as needed).
  const keepaliveInterval = setInterval(() => {
    console.log(`::notice:: LLM-safe: tests alive @ ${new Date().toISOString()}`);
  }, 15000); // Every 15s.
  child.on('exit', () => clearInterval(keepaliveInterval));
}

main();
