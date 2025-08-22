import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import { applyMarkdownExtensions } from '../../lib/markdown/index.js';
import { createCalloutShortcode } from '../../eleventy.config.mjs';

test('callout renders content without inner footnotes block', () => {
  const md = applyMarkdownExtensions(new MarkdownIt().use(markdownItFootnote));
  const config = { markdownLibrary: md };
  const callout = createCalloutShortcode(config);
  const ctx = { env: { filters: { escape: (s) => s } } };
  const html = callout.call(ctx, 'Check[^1]\n\n[^1]: note');
  assert.ok(/annotation-ref/.test(html), 'footnote reference rendered');
  assert.ok(!html.includes('footnotes-hybrid'), 'no inner footnotes block');
  assert.ok(!html.includes('<section class="footnotes">'), 'no footnotes section rendered');
});
