import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildLean } from '../helpers/eleventy-env.mjs';

test('archive nav exposes child counts', async () => {
  const outDir = await buildLean('archive-nav-count');
  const htmlPath = path.join(outDir, 'archives', 'collectables', 'designer-toys', 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /Pop Mart/);
  assert.match(html, /font-mono text-xs\">\(1\)/);
});
