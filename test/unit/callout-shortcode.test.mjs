import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import { applyMarkdownExtensions } from '../../lib/markdown/index.js';
import { createCalloutShortcode } from '../../eleventy.config.mjs';
import path from 'node:path';

test('callout splices only referenced footnotes', () => {
  const md = applyMarkdownExtensions(new MarkdownIt().use(markdownItFootnote));
  const config = { markdownLibrary: md };
  const callout = createCalloutShortcode(config);
  const fixture = path.join('test', 'unit', 'fixtures', 'callout-page.md');
  const ctx = { page: { inputPath: fixture }, env: { filters: { escape: (s) => s } } };
  const html = callout.call(ctx, 'Check[^4]');
  assert.ok(/annotation-ref/.test(html), 'footnote reference rendered');
  assert.ok(!html.includes('[^4]'), 'raw footnote ref removed');
  assert.ok(!html.includes('fn9'), 'unused footnote definition not included');
  assert.ok(!/footnotes-hybrid/.test(html), 'no inner footnotes block');
});
