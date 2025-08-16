import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { withImages, buildLean } from '../helpers/eleventy-env.mjs';

test('logo image transforms to avif and webp', withImages(async () => {
  const imageDir = path.join('_site', 'assets', 'images');
  rmSync(imageDir, { recursive: true, force: true });
  const outDir = await buildLean('logo-image');
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const dom = new JSDOM(html);
  const picture = dom.window.document.querySelector('picture');
  assert(picture, 'picture element exists');
  const sources = Array.from(picture.querySelectorAll('source'));
  const types = sources.map(s => s.getAttribute('type'));
  assert(types.includes('image/avif'));
  assert(types.includes('image/webp'));
  const img = picture.querySelector('img.hero-logo');
  assert(img);
  const files = sources.map(s => s.getAttribute('srcset').split(' ')[0]);
  files.push(img.getAttribute('src'));
  files.forEach(f => {
    const p = path.join(imageDir, path.basename(f));
    assert(existsSync(p), `${f} exists`);
  });
}));
