// tools/select.mjs
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * Asynchronously gets a list of all files tracked by Git.
 * @returns {Promise<string[]>} A promise that resolves to an array of file paths.
 */
function getGitTrackedFiles() {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['ls-files'], { cwd: repoRoot });
    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => (stdout += data));
    git.stderr.on('data', (data) => (stderr += data));

    git.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.split('\n').filter(Boolean));
      } else {
        reject(new Error(`git ls-files exited with code ${code}:\n${stderr}`));
      }
    });
    git.on('error', reject);
  });
}

/**
 * Reads the test ledger file to get metadata about tests.
 * @returns {Promise<object>} A promise that resolves to the ledger object.
 */
async function getTestLedger() {
  try {
    const ledgerPath = path.join(repoRoot, 'tools', 'test-ledger.json');
    const content = await readFile(ledgerPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    // If the file doesn't exist or is invalid, return an empty object.
    if (error.code !== 'ENOENT') {
      console.warn('::warning:: Could not parse tools/test-ledger.json');
    }
    return {};
  }
}

/**
 * Infers capabilities based on the file path.
 * @param {string} file The file path.
 * @returns {object} An object containing inferred capabilities.
 */
function inferCaps(file) {
  const caps = {};
  if (file.includes('/browser/')) {
    caps.browser = true;
  }
  return caps;
}

/**
 * Finds all test files tracked by Git that match the given patterns.
 * @returns {Promise<Array<{file: string, caps: object}>>} A list of test file entries.
 */
export default async function select() {
  const testPatterns = [
    /^test\/unit\/.*\.test\.mjs$/,
    /^test\/unit\/.*\.spec\.mjs$/,
    /^test\/integration\/.*\.test\.mjs$/,
    /^test\/integration\/.*\.spec\.mjs$/,
    /^test\/browser\/.*\.test\.mjs$/,
    /^test\/browser\/.*\.spec\.mjs$/,
  ];

  const [allFiles, ledger] = await Promise.all([
    getGitTrackedFiles(),
    getTestLedger(),
  ]);

  const testFiles = allFiles.filter((file) =>
    testPatterns.some((pattern) => pattern.test(file))
  );

  return testFiles.map((file) => ({
    file,
    caps: {
      ...inferCaps(file),
      ...(ledger[file] || {}),
    },
  }));
}