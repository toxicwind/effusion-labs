import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const outDir = 'tmp/test-copy-build';

rmSync(outDir, { recursive: true, force: true });

test('code blocks expose copy control', () => {
  execSync(`npx @11ty/eleventy --quiet --input=src --output=${outDir}`, { stdio: 'inherit' });
  const htmlPath = path.join(outDir, 'content/meta/style-guide/index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const script = readFileSync('src/scripts/code-copy.js', 'utf8');
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  const btn = dom.window.document.querySelector('pre button[data-copy]');
  assert.ok(btn, 'copy button missing');
});
