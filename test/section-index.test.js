const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const nunjucks = require('nunjucks');

function render(section) {
  const file = fs.readFileSync(path.join('src','content',section,'index.njk'), 'utf8');
  const body = file.replace(/^---[\s\S]*?---\n/, '');
  const env = nunjucks.configure(['src/_includes','src/_includes/components'], { autoescape:false, noCache:true });
  env.addFilter('htmlDateString', (d) => new Date(d).toISOString());
  env.addFilter('readableDate', (d) => new Date(d).toISOString().slice(0,10));
  const item = {
    url: `/${section}/alpha/`,
    date: new Date('2025-08-01'),
    data: { title: 'Alpha', type: section.slice(0, -1) }
  };
  const collections = { [section]: [item] };
  const page = { url: `/${section}/` };
  return env.renderString(body, { collections, page }).trim();
}

['projects','concepts','sparks','meta'].forEach(section => {
  test(`${section} index uses list layout`, () => {
    const html = render(section);
    assert.match(html, /<ul class="space-y-4">/);
    assert.match(html, /class="block rounded-lg/);
  });
});
