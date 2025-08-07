// test/theme-toggle.test.mjs

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

function build() {
  execSync('npx @11ty/eleventy', { stdio: 'inherit' });
}

test('theme toggle present and color-scheme meta applied', () => {
  build();
  const html = fs.readFileSync('_site/index.html', 'utf8');
  assert.match(html, /id="theme-toggle"/, 'theme toggle missing');
  assert.match(html, /meta name="color-scheme" content="dark light"/);
  assert.match(html, /prefers-color-scheme/);
});

test('theme toggle updates html data-theme attribute (unit)', () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <button id="theme-toggle">
      <i class="lucide-sun hidden"></i>
      <i class="lucide-moon"></i>
    </button>
  </body></html>`, { url: 'http://localhost', runScripts: 'dangerously' });

  // Simulate no system dark preference
  dom.window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });

  const script = fs.readFileSync('src/scripts/theme-toggle.js', 'utf8');
  dom.window.eval(script);

  const htmlEl = dom.window.document.documentElement;
  assert.equal(htmlEl.getAttribute('data-theme'), 'lab');

  dom.window.document.getElementById('theme-toggle').click();
  assert.equal(htmlEl.getAttribute('data-theme'), 'dark');
});

test('theme toggle switches data-theme and class on click (integration)', () => {
  build();
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost' });
  const { window } = dom;

  // Simulate no system dark preference
  window.matchMedia = () => ({ matches: false });

  const script = fs.readFileSync('src/scripts/theme-toggle.js', 'utf8');
  window.eval(script);

  const docEl = window.document.documentElement;
  assert.equal(docEl.getAttribute('data-theme'), 'lab');

  const btn = window.document.getElementById('theme-toggle');
  btn.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(docEl.getAttribute('data-theme'), 'dark');
  assert.ok(docEl.classList.contains('dark'));

  btn.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(docEl.getAttribute('data-theme'), 'lab');
  assert.ok(!docEl.classList.contains('dark'));
});
