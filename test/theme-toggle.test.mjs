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

const htmlFrag = `<!DOCTYPE html><html><head><meta name="color-scheme" content="dark light"></head><body><button id="theme-toggle"><i class="lucide-sun hidden"></i><i class="lucide-moon"></i></button></body></html>`;

test('build includes toggle and dark-default meta', () => {
  build();
  const html = fs.readFileSync('_site/index.html', 'utf8');
  assert.match(html, /id="theme-toggle"/, 'theme toggle missing');
  assert.match(html, /meta name="color-scheme" content="dark light"/);
  assert.match(html, /<html[^>]*data-theme="dark"/);
});

test('initial paint defaults to dark', () => {
  const dom = new JSDOM(htmlFrag, { url: 'http://localhost', runScripts: 'dangerously' });
  dom.window.localStorage.removeItem('theme');
  dom.window.eval(initScript);
  const docEl = dom.window.document.documentElement;
  assert.equal(docEl.dataset.theme, 'dark');
  assert.equal(dom.window.document.querySelector('meta[name="color-scheme"]').content, 'dark light');
});

test('initial paint uses stored light preference', () => {
  const dom = new JSDOM(htmlFrag, { url: 'http://localhost', runScripts: 'dangerously' });
  dom.window.localStorage.setItem('theme', 'light');
  dom.window.eval(initScript);
  const docEl = dom.window.document.documentElement;
  assert.equal(docEl.dataset.theme, 'light');
  assert.equal(dom.window.document.querySelector('meta[name="color-scheme"]').content, 'light dark');
});

test('toggle switches to light and persists on desktop', () => {
  const dom = new JSDOM(htmlFrag, { url: 'http://localhost', runScripts: 'dangerously' });
  dom.window.eval(initScript);
  dom.window.eval(toggleScript);
  const docEl = dom.window.document.documentElement;
  const btn = dom.window.document.getElementById('theme-toggle');
  assert.equal(docEl.dataset.theme, 'dark');
  btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  assert.equal(docEl.dataset.theme, 'light');
  assert.equal(dom.window.localStorage.getItem('theme'), 'light');
});

test('toggle switches to light on touch devices', () => {
  const dom = new JSDOM(htmlFrag, { url: 'http://localhost', runScripts: 'dangerously' });
  Object.defineProperty(dom.window.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)' });
  dom.window.eval(initScript);
  dom.window.eval(toggleScript);
  const docEl = dom.window.document.documentElement;
  const btn = dom.window.document.getElementById('theme-toggle');
  assert.equal(docEl.dataset.theme, 'dark');
  btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  assert.equal(docEl.dataset.theme, 'light');
});

test('integration toggle on built site', () => {
  build();
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost' });
  dom.window.eval(initScript);
  dom.window.eval(toggleScript);
  const docEl = dom.window.document.documentElement;
  const btn = dom.window.document.getElementById('theme-toggle');
  assert.equal(docEl.dataset.theme, 'dark');
  btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  assert.equal(docEl.dataset.theme, 'light');
  assert.ok(!docEl.classList.contains('dark'));
});
