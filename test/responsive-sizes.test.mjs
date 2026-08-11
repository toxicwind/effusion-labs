import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

test('responsive images include multiple widths and auto sizes', () => {
  spawnSync('npx', ['@11ty/eleventy'], { stdio: 'ignore' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const match = html.match(/<img[^>]*srcset="([^"]+)"[^>]*sizes="([^"]+)"/);
  assert.ok(match);
  const widths = match[1].split(',');
  assert.ok(widths.length > 1);
  assert.equal(match[2], 'auto');
});
