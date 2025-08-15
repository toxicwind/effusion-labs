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
