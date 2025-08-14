import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

test('hero renders without logo and with poster headline', () => {
  spawnSync('npx', ['@11ty/eleventy'], { stdio: 'ignore' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const dom = new JSDOM(html);
  const img = dom.window.document.querySelector('img[alt="Effusion Labs"]');
  assert.ok(!img, 'hero logo should be absent');
  const h1 = dom.window.document.querySelector('h1');
  assert.equal(h1.textContent.trim(), 'EFFUSION LABS');
});
