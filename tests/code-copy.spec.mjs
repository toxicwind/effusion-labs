import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import runEleventy from './helpers/eleventy.js';

test('code blocks expose copy control', () => {
  const outDir = runEleventy('code-copy');
  const htmlPath = path.join(outDir, 'content/meta/style-guide/index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const script = readFileSync('src/scripts/code-copy.js', 'utf8');
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  const btn = dom.window.document.querySelector('pre button[data-copy]');
  assert.ok(btn, 'copy button missing');
});
