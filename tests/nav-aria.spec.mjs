import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import runEleventy from './helpers/eleventy.js';

test('main nav marks current page and is labelled', () => {
  const outDir = runEleventy('nav-aria');
  const htmlPath = path.join(outDir, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /<nav[^>]*aria-label="Primary navigation"/);
  assert.match(html, /<a href="\/"[^>]*aria-current="page"/);
});
