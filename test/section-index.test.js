const test = require('node:test');
const assert = require('node:assert');
const nunjucks = require('nunjucks');

const sections = require('../src/_data/collectionIndexPages.json').map(p => p.collection);

function render(section) {
  const env = nunjucks.configure(['src/_includes','src/_includes/components','src'], { autoescape:false, noCache:true });
  env.addFilter('htmlDateString', (d) => new Date(d).toISOString());
  env.addFilter('readableDate', (d) => new Date(d).toISOString().slice(0,10));
  const item = {
    url: `/${section}/alpha/`,
    date: new Date('2025-08-01'),
    data: { title: 'Alpha', type: section.slice(0, -1) }
  };
  const collections = { [section]: [item] };
  const page = { url: `/${section}/` };
  return env.render('layouts/collection.njk', { intro: 'Intro', collectionName: section, collections, page }).trim();
}

sections.forEach(section => {
  test(`${section} layout renders list`, () => {
    const html = render(section);
    assert.match(html, /<ul class="space-y-4">/);
    assert.match(html, /class="block rounded-lg/);
  });
});
