import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import runEleventy from './utils/run-eleventy.mjs';

// Build the site and verify the layout exposes a build timestamp.
test('layout exposes build timestamp', () => {
  const outDir = runEleventy('build-timestamp');
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const match = html.match(/data-build="([^"]+)"/);
  assert.ok(match, 'data-build attribute missing');
  assert.match(match[1], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
