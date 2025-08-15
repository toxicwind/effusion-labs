import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default function runEleventy(
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
