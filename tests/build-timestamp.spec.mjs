import test from 'node:test';
import assert from 'node:assert';
import { rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const outDir = 'tmp/test-build';

rmSync(outDir, { recursive: true, force: true });

function buildAndRead(relPath) {
  execSync('npx @11ty/eleventy --quiet --input=src --output=' + outDir, { stdio: 'inherit' });
  return readFileSync(path.join(outDir, relPath), 'utf8');
}

// Build the site and verify the layout exposes a build timestamp.
test('layout exposes build timestamp', () => {
  const html = buildAndRead('index.html');
  const match = html.match(/data-build="([^"]+)"/);
  assert.ok(match, 'data-build attribute missing');
  assert.match(match[1], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
