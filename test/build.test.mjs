import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

function build() {
  execSync('npx @11ty/eleventy', { stdio: 'inherit' });
}

test('Eleventy build produces compiled CSS', () => {
  build();
  assert.ok(fs.existsSync('_site/assets/css/app.css'));
});
