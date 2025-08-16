import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { withImages, buildLean } from '../helpers/eleventy-env.mjs';

test('transformed images have slugified filenames', withImages(async () => {
  rmSync(path.join('_site', 'assets', 'images'), { recursive: true, force: true });
  const outDir = await buildLean('image-filename');
  const imageDir = path.join(outDir, 'assets', 'images');
  const files = readdirSync(imageDir);
  const logoFiles = files.filter(f => f.startsWith('logo-'));
  assert(logoFiles.length > 0, 'logo images were generated with slugified filenames');
  logoFiles.forEach(f => {
    assert.match(f, /^logo-\d+\.(avif|webp|png)$/);
  });
}));
