import MarkdownIt from 'markdown-it';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import links from '../../lib/markdown/links.js';
const { externalLinks } = links;

// Acceptance example: external source links get arrow text and class
await test('source link renders with arrow and class', () => {
  const md = new MarkdownIt();
  md.use(externalLinks);
  const html = md.render('[source](https://example.com)');
  assert.match(html, /class="external-link"/);
  assert.ok(html.includes('↗ source'));
});

// Property: other links preserve their original text
await test('non-source link keeps text', () => {
  const md = new MarkdownIt();
  md.use(externalLinks);
  const html = md.render('[Example](https://example.com)');
  assert.ok(html.includes('Example'));
  assert.ok(!html.includes('↗ source'));
});
