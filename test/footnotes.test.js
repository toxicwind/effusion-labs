const assert = require('node:assert');
const { test } = require('node:test');
const markdownIt = require('markdown-it');
const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');
const { mdItExtensions } = require('../lib/markdown');

test('footnote popover renders annotation markup', () => {
  const md = markdownIt();
  md.use(markdownItFootnote);
  md.use(markdownItAttrs);
  mdItExtensions.forEach(fn => fn(md));
  const html = md.render('hello[^1]\n\n[^1]: world');
  assert.ok(html.includes('annotation-popup'));
});

test('footnotes are not appended to the end of the document', () => {
  const md = markdownIt();
  md.use(markdownItFootnote);
  md.use(markdownItAttrs);
  mdItExtensions.forEach(fn => fn(md));
  const html = md.render('hi[^1]\n\n[^1]: there');
  assert.ok(!html.includes('<section class="footnotes">'));
});
