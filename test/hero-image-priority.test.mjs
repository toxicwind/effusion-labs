import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

test('hero logo eager loads with high priority and explicit size', () => {
  spawnSync('npx', ['@11ty/eleventy'], { stdio: 'ignore' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const dom = new JSDOM(html);
  const img = dom.window.document.querySelector('img[alt="Effusion Labs"]');
  assert.ok(img);
  assert.equal(img.getAttribute('loading'), 'eager');
  assert.equal(img.getAttribute('fetchpriority'), 'high');
  const width = parseInt(img.getAttribute('width'), 10);
  const height = parseInt(img.getAttribute('height'), 10);
  assert.ok(width > 0 && height > 0);
  assert.equal(width, 112);
  assert.equal(height, 112);
  assert.equal(width, height);
});
