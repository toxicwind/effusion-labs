import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

test('base headings use fluid type scale', () => {
  spawnSync('npx', ['@11ty/eleventy'], { stdio: 'ignore' });
  const css = fs.readFileSync('_site/assets/css/app.css', 'utf8');
  assert.match(css, /h1\s*\{[^}]*font-size:\s*clamp/);
  assert.match(css, /h2\s*\{[^}]*font-size:\s*clamp/);
});
