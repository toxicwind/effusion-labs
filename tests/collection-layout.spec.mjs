import test from 'node:test';
import assert from 'node:assert';
import { rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const outDir = 'tmp/test-build';

rmSync(outDir, { recursive: true, force: true });

// Build the site to a temp directory and verify section metadata
// is present on collection index pages.
test('collection pages expose section metadata', () => {
  execSync('npx @11ty/eleventy --quiet --input=src --output=' + outDir, { stdio: 'inherit' });
  for (const section of ['sparks', 'concepts', 'projects']) {
    const htmlPath = path.join(outDir, section, 'index.html');
    const html = readFileSync(htmlPath, 'utf8');
    assert.match(html, new RegExp(`data-section="${section}"`));
  }
});
