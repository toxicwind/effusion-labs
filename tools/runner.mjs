import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { execSync } from 'node:child_process';
import process from 'node:process';
import probe from './probe.mjs';
import select from './select.mjs';

// --- Test Impact Analysis ---
// Determines which tests to run based on recent file changes.
// This avoids running the full test suite for minor changes, improving efficiency.
function getImpactedTests(allTests) {
  try {
    // Get a list of files changed since the last commit on the current branch.
    const diffOutput = execSync('git diff --name-only HEAD~1 HEAD').toString();
    const changedFiles = diffOutput.split('\n').filter(Boolean);

    if (changedFiles.length === 0) {
      console.log('::notice:: No file changes detected. Running all tests as a baseline.');
      return allTests;
    }

    console.log(`::notice:: Detected changes in: ${changedFiles.join(', ')}`);
    // Heuristic: if a test file's name relates to a changed source file, it's considered impacted.
    // For more accuracy, this could be replaced with a static code analysis tool that builds a dependency graph.
    const impacted = allTests.filter(test =>
      changedFiles.some(changedFile => test.file.includes(changedFile.replace('.js', '')))
    );

    if (impacted.length > 0) {
      console.log(`::notice:: Running ${impacted.length} impacted tests based on git diff.`);
      return impacted;
    } else {
      console.log('::warning:: Could not map changes to specific tests. Running all tests.');
      return allTests;
    }
  } catch (error) {
    console.error('::error:: Failed to get git diff. Running all tests as a fallback.', error);
    return allTests;
  }
}

async function main() {
  const allFlag = process.argv.includes('--all');
  let tests = await select({ all: true }); // Select all tests initially for the impact analysis.
  const caps = await probe();

  // --- Intelligent Test Selection ---
  // If the '--all' flag is not present, filter down to only the impacted tests.
  if (!allFlag) {
    tests = getImpactedTests(tests);
  }

  const execute = [];
  const parked = [];
  for (const t of tests) {
    // Park tests if their required capabilities (e.g., a browser environment) are not present.
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

  // --- Parallel Execution ---
  // Utilizes all available CPU cores to run tests in parallel for maximum speed.
  const numCores = cpus().length;
  const concurrency = Math.max(1, numCores - 1); // Leave one core free for system stability.
  console.log(`::notice:: Executing ${execute.length} tests with a concurrency of ${concurrency}...`);

  const extraImports =
    process.env.LLM_KEEPALIVE_IMPORTS ||
    '--import=./test/setup/http.mjs --import=./test/setup/llm-keepalive.mjs';
  const envNodeOptions = `${process.env.NODE_OPTIONS || ''} ${extraImports}`.trim();

  // The `--test-concurrency` flag enables Node.js's built-in parallel test runner.
  const child = spawn(process.execPath, ['--test', `--test-concurrency=${concurrency}`, '--test-reporter=spec', ...execute], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: envNodeOptions,
      LLM_KEEPALIVE_INJECTED: '1',
    },
  });

  child.on('exit', code => {
    console.log(`Executed ${execute.length} tests.`);
    if (parked.length) {
      console.log(`Parked ${parked.length} tests:`);
      parked.slice(0, 200).forEach(p => console.log(`${p.file}\t${p.reason}`));
    }
    process.exit(code);
  });
}

main();