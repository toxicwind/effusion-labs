import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

function build() {
  execSync('npx @11ty/eleventy', { stdio: 'inherit' });
}

test('layout provides skip link to main content', () => {
  build();
  const html = fs.readFileSync('_site/index.html', 'utf8');
  assert.ok(html.includes('class="skip-link"'), 'skip link missing');
  assert.ok(html.includes('id="main"'), 'main id missing');
});
