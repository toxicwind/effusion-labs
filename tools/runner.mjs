// tools/runner.mjs
import { spawn, execSync } from 'node:child_process';
import { cpus, loadavg } from 'node:os';
import process from 'node:process';
import probe from './probe.mjs';
import select from './select.mjs';

// --- Shared Eleventy Build ---
// Performs a single Eleventy build and returns the output dir for tests to share.
async function runEleventyBuild() {
  console.log('::notice:: Performing single Eleventy build for all tests...');
  const outputDir = '/tmp/eleventy-build'; // Use a temp dir; clean it first if needed.

  // Heartbeat while Eleventy is building so wrappers never think we're idle.
  const buildKeepalive = setInterval(() => {
    console.log(`::notice:: LLM-safe: build alive @ ${new Date().toISOString()}`);
  }, 15_000);

  try {
    execSync(`rm -rf ${outputDir}`); // Clean previous build.
    // Ensure single, non-watch build; inherit stdio for progress.
    execSync(`ELEVENTY_ENV=test WATCH=0 npx @11ty/eleventy --output=${outputDir}`, {
      stdio: 'inherit',
    });
    console.log(`::notice:: Eleventy build complete. Output: ${outputDir}`);
    return outputDir;
  } catch (error) {
    console.error('::error:: Eleventy build failed. Falling back to per-test builds.', error);
    return null; // Tests will handle their own builds if this fails.
  } finally {
    clearInterval(buildKeepalive);
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
  const broadChanges = changedFiles.some(
    (file) =>
      file.includes('package.json') ||
      file.includes('package-lock.json') ||
      file.includes('scripts/') ||
      file.includes('config/')
  );
  if (broadChanges) {
    console.log('::notice:: Broad changes detected (e.g., config/scripts). Running all tests.');
    return allTests;
  }

  // Match tests to changes: partial includes, regex for variants (e.g., 'register.js' impacts 'eleventy' tests).
  const impacted = allTests.filter((test) =>
    changedFiles.some((changedFile) => {
      const base = changedFile.replace(/\.(js|json|sh|mjs|njk|md)$/, '').toLowerCase();
      const testBase = test.file.toLowerCase();
      return testBase.includes(base) || new RegExp(base.replace(/[-/]/g, '.*')).test(testBase);
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

  // Hoist Eleventy build for sharing unless explicitly running all.
  const sharedBuildDir = allFlag ? null : await runEleventyBuild();

  // Filter to impacted tests.
  let changedFiles = [];
  try {
    const diffOutput = execSync('git diff --name-only HEAD~1 HEAD').toString();
    changedFiles = diffOutput.split('\n').filter(Boolean);
  } catch {
    // no-op: on fresh clones without history, run all tests
  }
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
      parked.slice(0, 200).forEach((p) => console.log(`${p.file}\t${p.reason}`));
    }
    console.log('::notice:: TEST_RUN_DONE code=0');
    process.exit(0);
    return;
  }

  // Dynamic concurrency: Use most cores, but throttle if load is high.
  const numCores = cpus().length;
  const systemLoad = loadavg()[0]; // 1-min load average.
  let concurrency = Math.max(1, numCores - 1);
  if (systemLoad > numCores * 0.8) {
    concurrency = Math.floor(concurrency / 2); // Throttle under high load.
  }
  console.log(
    `::notice:: Executing ${execute.length} tests with concurrency ${concurrency} (load: ${systemLoad.toFixed(
      2
    )})...`
  );

  const extraImports =
    process.env.LLM_KEEPALIVE_IMPORTS ||
    '--import=./test/setup/http.mjs --import=./test/setup/llm-keepalive.mjs';
  const envNodeOptions = `${process.env.NODE_OPTIONS || ''} ${extraImports}`.trim();

  // Spawn the node test runner
  const child = spawn(
    process.execPath,
    ['--test', `--test-concurrency=${concurrency}`, '--test-reporter=spec', ...execute],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: envNodeOptions,
        LLM_KEEPALIVE_INJECTED: '1',
        ELEVENTY_BUILD_DIR: sharedBuildDir || '', // Tests can check this and skip internal builds.
      },
      // spawn does not honor a "timeout" option; we implement our own watchdog below.
    }
  );

  // Forward Ctrl-C/TERM to child so we don't leave zombies.
  const forward = (sig) => {
    try {
      child.kill(sig);
    } catch {}
  };
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  // Hard ceiling watchdog to avoid indefinite hangs.
  const MAX_MS = Number(process.env.TEST_MAX_MS || 20 * 60 * 1000); // default 20 minutes
  const watchdog = setTimeout(() => {
    console.error('::error:: Test runner watchdog timed out — terminating child...');
    forward('SIGTERM');
    setTimeout(() => forward('SIGKILL'), 5_000);
  }, MAX_MS);

  // Keepalive emitter during tests so wrappers register liveness.
  const keepaliveInterval = setInterval(() => {
    console.log(`::notice:: LLM-safe: tests alive @ ${new Date().toISOString()}`);
  }, 15_000); // Every 15s.

  // Ensure cleanup of keepalive on abnormal child errors too.
  child.on('error', () => clearInterval(keepaliveInterval));

  child.on('exit', (code) => {
    clearTimeout(watchdog);
    clearInterval(keepaliveInterval);
    console.log(`Executed ${execute.length} tests.`);
    if (parked.length) {
      console.log(`Parked ${parked.length} tests:`);
      parked.slice(0, 200).forEach((p) => console.log(`${p.file}\t${p.reason}`));
    }
    // Final sentinel for external wrappers.
    console.log(`::notice:: TEST_RUN_DONE code=${code}`);
    process.exit(code);
  });

  // Catch uncaughts in the runner itself and make sure we print a sentinel.
  process.on('uncaughtException', (err) => {
    try {
      clearTimeout(watchdog);
      clearInterval(keepaliveInterval);
    } catch {}
    console.error('::error:: Uncaught exception in runner:', err);
    console.log('::notice:: TEST_RUN_DONE code=1');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    try {
      clearTimeout(watchdog);
      clearInterval(keepaliveInterval);
    } catch {}
    console.error('::error:: Unhandled rejection in runner:', reason);
    console.log('::notice:: TEST_RUN_DONE code=1');
    process.exit(1);
  });
}

main();
