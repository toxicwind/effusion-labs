import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Uses the shared Eleventy build that the runner performs once.
const BUILD_DIR = process.env.ELEVENTY_BUILD_DIR || '/tmp/eleventy-build';

test('A1–A3: wikilinks resolve to canonical dynamic archive routes', async () => {
  const htmlPath = path.join(BUILD_DIR, 'test', 'dynamic-archives', 'index.html');
  assert.ok(fs.existsSync(htmlPath), 'built HTML exists for test page');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Series → /archives/series/lets-checkmate/
  assert.match(html, /href="\/archives\/series\/lets-checkmate\//, 'series link canonical href present');

  // Character → /archives/character/momo-fox/
  assert.match(html, /href="\/archives\/character\/momo-fox\//, 'character link canonical href present');

  // Product → /archives/product/tempura-shrimp/
  assert.match(html, /href="\/archives\/product\/tempura-shrimp\//, 'product link canonical href present');
});

