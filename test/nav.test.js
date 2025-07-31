const nav = require('../src/_data/nav');
const assert = require('node:assert');
const { test } = require('node:test');

test('navigation contains expected links', () => {
  assert.ok(Array.isArray(nav), 'nav is an array');
  assert.strictEqual(nav.length, 6);
  for (const item of nav) {
    assert.ok(item.url && item.label, 'item has url and label');
  }
});
