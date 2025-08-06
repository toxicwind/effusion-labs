import { test } from 'node:test';
import assert from 'node:assert';
import markdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItAttrs from 'markdown-it-attrs';
import { mdItExtensions } from '../lib/markdown/index.js';

function render(src) {
  const md = markdownIt();
  md.use(markdownItFootnote);
  md.use(markdownItAttrs);
  mdItExtensions.forEach(fn => fn(md));
  return md.render(src);
}

test('no footnotes yields no aside or annotations', () => {
  const html = render('plain text');
  assert.ok(!html.includes('<aside'));
  assert.ok(!html.includes('annotation-ref'));
});

test('single footnote renders popover and aside', () => {
  const html = render('hi[^1]\n\n[^1]: there');
  assert.match(html, /<div class="footnotes-hybrid">/);
  // popover-enabled reference
  assert.match(html, /<sup class="annotation-ref/);
  assert.match(html, /<a href="#fn1" id="fnreffn1" class="annotation-anchor" aria-describedby="popup-fn1">\[1\]<\/a>/);
  assert.match(html, /<span id="popup-fn1" role="tooltip" class="annotation-popup"/);
  // footnote card structure
  assert.match(html, /<aside class="footnote-aside not-prose" role="note">/);
  assert.match(html, /<div id="fn1" class="footnote-local">/);
  assert.match(html, /class="footnote-content"/);
  assert.match(html, /class="footnote-backref"/);
});

test('footnote reference includes popover markup', () => {
  const html = render('hi[^1]\n\n[^1]: there');
  assert.match(html, /<sup class="annotation-ref[^\"]*">/);
  assert.match(html, /class="annotation-anchor"/);
  assert.match(html, /class="annotation-popup">.*there/);
});
test('footnote blockquote merged and styled', () => {
  const html = render('x[^1]\n\n[^1]: base\n> explanation');
  assert.match(html, /<blockquote class="footnote-explanation">/);
});

test('nested blockquotes close aside correctly', () => {
  const html = render('x[^1]\n\n[^1]: outer\n> level1\n>> level2');
  const open = (html.match(/<aside/g) || []).length;
  const close = (html.match(/<\/aside>/g) || []).length;
  assert.equal(open, close);
  assert.match(html, /<blockquote class="footnote-explanation">/);
});
