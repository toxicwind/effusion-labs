import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import runEleventy from './utils/run-eleventy.mjs';

// Build the site to a temp directory and verify section metadata
// is present on collection index pages.
test('collection pages expose section metadata', () => {
  const outDir = runEleventy('collection-layout');
  for (const section of ['sparks', 'concepts', 'projects']) {
    const htmlPath = path.join(outDir, section, 'index.html');
    const html = readFileSync(htmlPath, 'utf8');
    assert.match(html, new RegExp(`data-section="${section}"`));
  }
});
