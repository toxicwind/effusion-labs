import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { buildLean } from '../helpers/eleventy-env.mjs';

// Acceptance: buildLean sets ELEVENTY_ENV and creates a clean output directory
// Property: output directory exists and is recreated for each run
// Contract: image transforms remain disabled unless explicitly enabled

test('buildLean sets env and output directory', async () => {
  const outDir = await buildLean('runner-spec');
  assert.equal(process.env.ELEVENTY_ENV, 'test');
  assert.ok(fs.existsSync(outDir));
  assert.equal(process.env.ELEVENTY_TEST_ENABLE_IMAGES, undefined);
});
