import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

test('responsive images include explicit dimensions', () => {
  spawnSync('npx', ['@11ty/eleventy'], { stdio: 'ignore' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const match = html.match(/<img[^>]*width="(\d+)"[^>]*height="(\d+)"/);
  assert.ok(match);
});
