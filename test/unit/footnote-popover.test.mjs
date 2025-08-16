import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import { applyMarkdownExtensions } from '../../lib/markdown/index.js';
import { JSDOM } from 'jsdom';

test('footnote popover separates source line', () => {
  const md = applyMarkdownExtensions(new MarkdownIt().use(markdownItFootnote));
  const input = 'Reference[^1]\n\n[^1]: Footnote text\n> Source: [Example](https://example.com)';
  const html = md.render(input);
  const dom = new JSDOM(html);
  const popup = dom.window.document.querySelector('.annotation-popup');
  assert.ok(popup, 'popover exists');
  const source = popup.querySelector('.footnote-source');
  assert.ok(source, 'source element exists');
  assert.ok(source.textContent.trim().startsWith('Source:'), 'source text starts with label');
  const link = source.querySelector('a');
  assert.ok(link, 'source contains a link');
  assert.notStrictEqual(source.previousElementSibling, null, 'source is separated from previous content');
});
