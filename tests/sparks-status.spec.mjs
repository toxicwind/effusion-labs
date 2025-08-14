import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import runEleventy from './utils/run-eleventy.mjs';

test('spark listings reveal status text', () => {
  const outDir = runEleventy('sparks-status');
  const htmlPath = path.join(outDir, 'sparks', 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /\[draft\]/);
});
