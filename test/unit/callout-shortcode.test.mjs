import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import { applyMarkdownExtensions } from '../../config/markdown/index.js';
import { createCalloutShortcode } from '../../eleventy.config.mjs';

test('callout merges footnotes into page pipeline', () => {
  const md = applyMarkdownExtensions(new MarkdownIt().use(markdownItFootnote));
  const config = { markdownLibrary: md };
  const callout = createCalloutShortcode(config);
  const env = {};
  const ctx = { ctx: env, env: { filters: { escape: (s) => s } } };
  const html = callout.call(ctx, 'Check[^1]\n\n[^1]: note');
  assert.ok(/annotation-ref/.test(html), 'footnote reference rendered');
  assert.ok(!html.includes('<section class="footnotes">'), 'no footnotes section rendered');
  assert.equal(env.footnotes?.list?.length, 1, 'footnote captured in env');
  const tokens = env.footnotes?.list?.[0]?.tokens;
  const hasNote = tokens?.some((t) => t.content?.includes('note'));
  assert.ok(hasNote, 'footnote definition carried over');
});
