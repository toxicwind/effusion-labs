import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

test('generated image derivatives exist', () => {
  spawnSync('npx', ['@11ty/eleventy'], { stdio: 'ignore' });
  assert.ok(fs.existsSync('_site/assets/images'));
  const files = fs.readdirSync('_site/assets/images');
  assert.ok(files.some(f => f.endsWith('.avif')));
  assert.ok(files.some(f => f.endsWith('.webp')));
});

