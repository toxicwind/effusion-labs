import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const SCRIPT_PATH = 'src/scripts/footnote-nav.js';

// Acceptance: footnote navigation should rely on external CSS and not inject styles
// Property: user with reduced motion preference should not get smooth scrolling

test('script does not inject inline style for highlight', () => {
  const script = readFileSync(SCRIPT_PATH, 'utf8');
  assert(!/createElement\(\s*'style'\)/.test(script),
    'footnote-nav should not create style elements');
});

test('css exposes footnote highlight via primary token', () => {
  const css = readFileSync('src/styles/app.tailwind.css', 'utf8');
  assert(/\.footnote-highlight/.test(css), 'CSS should define footnote-highlight class');
  assert(/var\(--p\)/.test(css), 'highlight uses primary color token');
});

test('clicking footnote link adds highlight class', () => {
  const html = `
    <html><head></head><body>
      <header style="height:50px"></header>
      <p>See note<a href="#fn1" class="footnote-ref">1</a></p>
      <div id="fn1" class="footnote-item">note</div>
    </body></html>`;
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.scrollTo = () => {};
  const scriptContent = readFileSync(SCRIPT_PATH, 'utf8');
  dom.window.eval(scriptContent);

  const link = dom.window.document.querySelector('a[href="#fn1"]');
  link.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

  const target = dom.window.document.getElementById('fn1');
  assert(target.classList.contains('footnote-highlight'),
    'target footnote should receive highlight class');
});

test('reduced motion users get instant scroll', () => {
  const html = `
    <html><head></head><body>
      <header style="height:50px"></header>
      <p>See note<a href="#fn1" class="footnote-ref">1</a></p>
      <div id="fn1" class="footnote-item">note</div>
    </body></html>`;
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  let scrollOpts = null;
  dom.window.scrollTo = opts => { scrollOpts = opts; };
  dom.window.matchMedia = () => ({ matches: true });
  const scriptContent = readFileSync(SCRIPT_PATH, 'utf8');
  dom.window.eval(scriptContent);

  const link = dom.window.document.querySelector('a[href="#fn1"]');
  link.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

  assert.equal(scrollOpts.behavior, 'auto');
});
