const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { baseContentPath } = require('../lib/constants');

function count(area) {
  return fs.readdirSync(path.join(baseContentPath, area))
    .filter(f => f.endsWith('.md') && f !== 'index.md').length;
}

test('content areas have at least three entries', () => {
  ['projects','concepts','sparks','meta'].forEach(area => {
    const c = count(area);
    assert.ok(c >= 3, `${area} has only ${c} entries`);
  });
});
