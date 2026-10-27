const test = require('node:test');
const assert = require('node:assert');
const nunjucks = require('nunjucks');

const env = nunjucks.configure(['src/_includes', 'src/_includes/components'], { autoescape: false, noCache: true });

test('kpis shows zero counts', () => {
  const tmpl = '{% from "components/kpis.njk" import kpis %}{{ kpis([{title:"Projects", url:"/projects/", count:0}]) }}';
  const html = env.renderString(tmpl);
  assert.match(html, /Projects\s*<span[^>]*>\(0\)<\/span>/);
});
