#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "--- 1. Purging Legacy Tools, Scripts, and Docs ---"
# This is the most critical step: completely removing the old tools and their large doc footprints.
git rm -r --ignore-unmatch \
  tools/web2md \
  tools/search2serp \
  webpage-to-markdown.js \
  scripts/e2e-serp-proxy-check.sh \
  scripts/outbound-proxy.e2e.mjs \
  scripts/web2md.spec.mjs \
  proxy_audit_report.md \
  tools/archive-docs.js \
  docs/knowledge \
  docs/reports

echo "--- 2. Cleaning Up Obsolete and Legacy Tests ---"
# Remove test files related to the now-deleted tools.
git rm -r --ignore-unmatch \
  test/search2serp-cli.test.mjs \
  test/parser.test.mjs \
  test/consent.test.mjs \
  test/url-builder.test.mjs \
  test/flareClient.test.mjs \
  test/archive-docs.test.js \
  test/inventory.test.mjs \
  test/web2md.cli.test.mjs \
  test/webpageToMarkdown.test.js

echo "--- 3. Standardizing the Eleventy Test Runner ---"
# Create a single, standardized helper for running Eleventy in tests.
mkdir -p tests/helpers
git mv tests/utils/run-eleventy.mjs tests/helpers/eleventy.js
rmdir --ignore-fail-on-non-empty tests/utils

# Find all test files using the old runner and update their import paths.
rg -l './utils/run-eleventy.mjs' tests | xargs sed -i 's#./utils/run-eleventy.mjs#./helpers/eleventy.js#'

# Overwrite the runner to use CommonJS for better compatibility.
cat <<'EOF' > tests/helpers/eleventy.js
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function runEleventy(
  testName,
  { input = 'src', log = true, images = false } = {},
) {
  const outDir = path.join('tmp', testName);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  process.env.ELEVENTY_ENV = 'test';
  process.env.CI = 'true';
  process.env.COMMIT_SHA = process.env.COMMIT_SHA || 'local';
  if (images) process.env.ELEVENTY_TEST_ENABLE_IMAGES = '1';

  const env = { ...process.env };
  const stdio = log ? 'inherit' : 'pipe';
  const cmd = `npx @11ty/eleventy --input=${input} --output=${outDir}`;
  try {
    execSync(cmd, { stdio, env });
  } catch (err) {
    if (!log && err.stderr) process.stderr.write(err.stderr);
    throw err;
  }
  return outDir;
}
module.exports = runEleventy;
EOF

echo "--- 4. Finalizing package.json and Updating Lockfile ---"
# Programmatically remove obsolete scripts and dependencies.
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  delete pkg.scripts.web2md;
  delete pkg.scripts['proxy:test'];
  delete pkg.scripts['docs:archive'];
  delete pkg.dependencies['@mozilla/readability'];
  delete pkg.dependencies['turndown'];
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
# Regenerate the lockfile to ensure it's in sync.
npm install --package-lock-only

echo "--- 5. Cleaning Lingering Codebase References ---"
# Remove the 'web2md_path' key from all JSONL data files.
rg -l '"web2md_path"' src/content/archives | xargs --no-run-if-empty sed -i 's/,"web2md_path":"[^"]*"//g'

# Remove entries for deleted tests from the test ledger.
node -e "
  const fs = require('fs');
  const ledgerPath = 'tools/test-ledger.json';
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const deletedTests = [
    'test/webpageToMarkdown.test.js',
    'test/web2md.cli.test.mjs'
  ];
  const filtered = ledger.filter(e => !deletedTests.includes(e.file));
  fs.writeFileSync(ledgerPath, JSON.stringify(filtered, null, 2) + '\n');
"

echo "✅ Cleanup complete."
echo "Run 'git status' to see all the staged changes."