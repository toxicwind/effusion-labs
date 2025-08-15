import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import runEleventy from './utils/run-eleventy.mjs';

// Build the site and verify markdown headings include anchor ids.
test('markdown headings include anchor ids', () => {
  const outDir = runEleventy('markdown-anchor');
  const htmlPath = path.join(outDir, 'content', 'meta', 'anchor-demo', 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /<h2 id="section-heading"/);
});
