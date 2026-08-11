import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

test('HTML transform outputs picture with avif and webp sources', () => {
  spawnSync('npx', ['@11ty/eleventy'], { stdio: 'ignore' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  assert.match(html, /<picture>/);
  assert.match(html, /type="image\/avif"/);
  assert.match(html, /type="image\/webp"/);
  assert.match(html, /<img[^>]*loading="lazy"/);
  assert.match(html, /decoding="async"/);
});
