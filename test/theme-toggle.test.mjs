import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

function build() {
  execSync('npx @11ty/eleventy', { stdio: 'inherit' });
}

const initScript = fs.readFileSync('src/scripts/theme-init.js', 'utf8');
const toggleScript = fs.readFileSync('src/scripts/theme-toggle.js', 'utf8');

test('build includes toggle and color-scheme meta', () => {
  build();
  const html = fs.readFileSync('_site/index.html', 'utf8');
  assert.match(html, /id="theme-toggle"/, 'theme toggle missing');
  assert.match(html, /meta name="color-scheme" content="dark light"/);
});

test('initial paint defaults to dark and respects stored preference', () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><meta name="color-scheme" content="dark light"></head><body><button id="theme-toggle"><i class="lucide-sun hidden"></i><i class="lucide-moon"></i></button></body></html>`, { url: 'http://localhost', runScripts: 'dangerously' });

  dom.window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
  dom.window.localStorage.removeItem('theme');
  dom.window.eval(initScript);
  const docEl = dom.window.document.documentElement;
  assert.equal(docEl.dataset.theme, 'dark');
  assert.equal(dom.window.document.querySelector('meta[name="color-scheme"]').content, 'dark light');

  docEl.dataset.theme = '';
  dom.window.localStorage.setItem('theme','light');
  dom.window.eval(initScript);
  assert.equal(docEl.dataset.theme,'light');

  docEl.dataset.theme = '';
  dom.window.localStorage.setItem('theme','auto');
  dom.window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
  dom.window.eval(initScript);
  assert.equal(docEl.dataset.theme,'light');
});

test('toggle switches theme and persists', () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><meta name="color-scheme" content="dark light"></head><body><button id="theme-toggle"><i class="lucide-sun hidden"></i><i class="lucide-moon"></i></button></body></html>`, { url: 'http://localhost', runScripts: 'dangerously' });
  dom.window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
  dom.window.eval(initScript);
  dom.window.eval(toggleScript);
  const docEl = dom.window.document.documentElement;
  const btn = dom.window.document.getElementById('theme-toggle');
  assert.equal(docEl.dataset.theme,'dark');
  btn.click();
  assert.equal(docEl.dataset.theme,'light');
  assert.equal(dom.window.localStorage.getItem('theme'),'light');
});

test('integration toggle on built site', () => {
  build();
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost' });
  dom.window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
  dom.window.eval(initScript);
  dom.window.eval(toggleScript);
  const docEl = dom.window.document.documentElement;
  const btn = dom.window.document.getElementById('theme-toggle');
  assert.equal(docEl.dataset.theme,'dark');
  btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  assert.equal(docEl.dataset.theme,'light');
  assert.ok(!docEl.classList.contains('dark'));
});
