import test from 'node:test';
import assert from 'node:assert';
import { rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const outDir = 'tmp/nav-aria-build';
rmSync(outDir, { recursive: true, force: true });

test('main nav marks current page and is labelled', () => {
  execSync('npx @11ty/eleventy --quiet --input=src --output=' + outDir, { stdio: 'inherit' });
  const htmlPath = path.join(outDir, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /<nav[^>]*aria-label="Main"/);
  assert.match(html, /<a href="\/"[^>]*aria-current="page"/);
});
