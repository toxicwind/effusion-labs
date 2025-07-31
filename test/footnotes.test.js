const assert = require('node:assert');
const { test } = require('node:test');
const markdownIt = require('markdown-it');
const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');
const { mdItExtensions } = require('../lib/markdown-extensions');

test('footnote popover renders annotation markup', () => {
  const md = markdownIt();
  md.use(markdownItFootnote);
  md.use(markdownItAttrs);
  mdItExtensions.forEach(fn => fn(md));
  const html = md.render('hello[^1]\n\n[^1]: world');
  assert.ok(html.includes('annotation-popup'));
});
