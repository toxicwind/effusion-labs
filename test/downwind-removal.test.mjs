import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function ensureBuild() {
  if (!fs.existsSync('_site/assets/css/app.css')) {
    execSync('npx @11ty/eleventy', { stdio: 'inherit' });
  }
}

test('downwind plugin removed from package', () => {
  assert.ok(!pkg.dependencies || !pkg.dependencies['@downwindcss/text-decoration']);
});

test('compiled CSS uses native decoration utilities', () => {
  ensureBuild();
  const css = fs.readFileSync('_site/assets/css/app.css', 'utf8');
  assert.ok(!/\.text-decoration-/.test(css));
  assert.ok(css.includes('decoration-') || css.includes('underline')); // crude check
});
