import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleUrl } from '../tools/search2serp/url.js';

test('builds default google url', () => {
  const url = buildGoogleUrl({ q:'hello world' });
  assert.equal(url, 'https://www.google.com/search?q=hello+world&hl=en&gl=us&num=10&start=0');
});

test('clamps num and start', () => {
  const url = buildGoogleUrl({ q:'test', num:50, start:-5 });
  assert.equal(url, 'https://www.google.com/search?q=test&hl=en&gl=us&num=20&start=0');
});
