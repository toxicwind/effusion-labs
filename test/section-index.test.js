const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

['projects','concepts','sparks'].forEach(section => {
  test(`${section} index uses collection layout`, () => {
    const file = fs.readFileSync(path.join('src','content',section,'index.njk'), 'utf8');
    const body = file.replace(/^---[\s\S]*?---\n/, '').trim();
    assert.strictEqual(body, '');
    assert.match(file, /layout: "layouts\/collection.njk"/);
    assert.match(file, new RegExp(`section: "${section}"`));
  });
});
