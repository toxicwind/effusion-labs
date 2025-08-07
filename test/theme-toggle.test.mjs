import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
function build(){
  execSync('npx @11ty/eleventy', { stdio: 'inherit' });
}
test('theme toggle present and color-scheme meta applied', () => {
  build();
  const html = fs.readFileSync('_site/index.html','utf8');
  assert.match(html, /id="theme-toggle"/, 'theme toggle missing');
  assert.match(html, /meta name="color-scheme" content="dark light"/);
  assert.match(html, /prefers-color-scheme/);
});
