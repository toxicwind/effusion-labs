import { test } from 'node:test';
import assert from 'node:assert';
import markdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItAnchor from 'markdown-it-anchor';
import { mdItExtensions } from '../lib/markdown/index.js';

function render(src) {
  const md = markdownIt();
  md.use(markdownItFootnote);
  md.use(markdownItAttrs);
  md.use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.headerLink({
      symbol: '#',
      placement: 'before'
    })
  });
  mdItExtensions.forEach(fn => fn(md));
  return md.render(src);
}

test('heading renders anchor link', () => {
  const html = render('## Example');
  assert.match(html, /<a[^>]+href="#example"/);
});
