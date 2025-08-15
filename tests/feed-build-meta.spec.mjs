import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';
import runEleventy from './utils/run-eleventy.mjs';

const require = createRequire(import.meta.url);
const dateToRfc822 = require('@11ty/eleventy-plugin-rss/src/dateRfc822.js');

test('feed exposes build metadata', () => {
  const outDir = runEleventy('feed-build-meta');
  const xml = readFileSync(path.join(outDir, 'feed.xml'), 'utf8');
  assert.match(xml, /<!-- build: [0-9a-f]{7} -->/);
  const dateMatch = xml.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/);
  assert.ok(dateMatch);
  const parsed = new Date(dateMatch[1]);
  assert.ok(!isNaN(parsed));
  assert.equal(dateMatch[1], dateToRfc822(parsed));

  const items = (xml.match(/<item>/g) || []).length;
  assert.ok(items <= 20);
});
