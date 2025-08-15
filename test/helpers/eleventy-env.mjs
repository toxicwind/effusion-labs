import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function buildEleventy(testName, { input = 'src', images = false, log = false } = {}) {
  const outDir = path.join('tmp', testName);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const env = {
    ...process.env,
    ELEVENTY_ENV: 'test',
    CI: 'true',
    COMMIT_SHA: process.env.COMMIT_SHA || 'local',
  };
  if (images) env.ELEVENTY_TEST_ENABLE_IMAGES = '1';
  else delete env.ELEVENTY_TEST_ENABLE_IMAGES;

  execSync(`npx @11ty/eleventy --input=${input} --output=${outDir}`, {
    stdio: log ? 'inherit' : 'pipe',
    env,
  });
  return outDir;
}

export function withImages(fn) {
  return async (...args) => {
    process.env.ELEVENTY_TEST_ENABLE_IMAGES = '1';
    try {
      return await fn(...args);
    } finally {
      delete process.env.ELEVENTY_TEST_ENABLE_IMAGES;
    }
  };
}
