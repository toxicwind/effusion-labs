import fs from 'node:fs';
import path from 'node:path';
import Eleventy from '@11ty/eleventy';

export async function buildLean(testName, { input = 'src' } = {}) {
  const outDir = path.join('tmp', testName);
  const cacheDir = path.join('.cache', testName);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  process.env.ELEVENTY_ENV = 'test';
  process.env.CI = 'true';
  process.env.COMMIT_SHA = process.env.COMMIT_SHA || 'local';
  process.env.TZ = 'UTC';
  process.env.ELEVENTY_SEED = '1';
  process.env.ELEVENTY_CACHE_DIR = cacheDir;
  process.env.ELEVENTY_TEST_OUTPUT = outDir;

  const elev = new Eleventy(input, outDir, { quietMode: true });
  await elev.write();
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
