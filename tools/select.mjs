// tools/select.mjs
import { exec } from 'node:child_process/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * Finds all test files tracked by Git and enriches them with metadata.
 */
export default async function select() {
  const testPatterns = [
    /^test\/unit\/.*\.test\.mjs$/,
    /^test\/integration\/.*\.test\.mjs$/,
    /^test\/browser\/.*\.test\.mjs$/,
  ];

  // Fetch the list of all files from git and the test ledger data in parallel.
  const [allFiles, ledger] = await Promise.all([
    exec('git ls-files', { cwd: repoRoot }).then(({ stdout }) => stdout.split('\n').filter(Boolean)),
    readFile(path.join(repoRoot, 'tools', 'test-ledger.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => ({})), // Gracefully handle missing or invalid ledger file.
  ]);

  const testFiles = allFiles.filter((file) =>
    testPatterns.some((pattern) => pattern.test(file))
  );

  // Map the final list to the desired structure, adding capabilities.
  return testFiles.map((file) => ({
    file,
    caps: {
      browser: file.includes('/browser/'), // Infer browser capability directly.
      ...(ledger[file] || {}), // Merge with any data from the ledger.
    },
  }));
}