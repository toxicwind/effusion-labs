import test from 'node:test';
import assert from 'node:assert';
import { rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const outDir = 'tmp/test-build';

rmSync(outDir, { recursive: true, force: true });

test('archive nav exposes child counts', () => {
  execSync('npx @11ty/eleventy --quiet --input=src --output=' + outDir, { stdio: 'inherit' });
  const htmlPath = path.join(outDir, 'archives', 'collectables', 'designer-toys', 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /Pop Mart/);
  assert.match(html, /font-mono text-xs\">\(1\)/);
});
