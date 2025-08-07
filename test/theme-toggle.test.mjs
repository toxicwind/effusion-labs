import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
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

test('theme toggle updates html data-theme attribute', () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <button id="theme-toggle">
      <i class="lucide-sun hidden"></i>
      <i class="lucide-moon"></i>
    </button>
  </body></html>`, { url: 'http://localhost', runScripts: 'dangerously' });

  dom.window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });

  const script = fs.readFileSync('src/scripts/theme-toggle.js', 'utf8');
  dom.window.eval(script);

  const html = dom.window.document.documentElement;
  assert.equal(html.dataset.theme, 'lab');

  dom.window.document.getElementById('theme-toggle').click();
  assert.equal(html.dataset.theme, 'dark');
});
