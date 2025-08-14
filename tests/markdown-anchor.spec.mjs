import test from 'node:test';
import assert from 'node:assert';
import { rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const outDir = 'tmp/test-build';

rmSync(outDir, { recursive: true, force: true });

// Build the site and verify markdown headings include anchor ids.
test('markdown headings include anchor ids', () => {
  execSync('npx @11ty/eleventy --quiet --input=src --output=' + outDir, { stdio: 'inherit' });
  const htmlPath = path.join(outDir, 'content', 'meta', 'anchor-demo', 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /<h2 id="section-heading"/);
});
