import test from 'node:test';
import assert from 'node:assert';
import nav from '../src/_data/nav.js';

test('navigation data entries have title and url', () => {
  for (const item of nav) {
    assert.strictEqual(typeof item.title, 'string');
    assert.ok(item.title.length > 0);
    assert.strictEqual(typeof item.url, 'string');
    assert.ok(item.url.startsWith('/'));
  }
});
