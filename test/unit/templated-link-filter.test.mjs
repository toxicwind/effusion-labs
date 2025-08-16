import test from 'node:test';
import assert from 'node:assert/strict';
import { removeTemplatedLinks } from '../../lib/templated-link-filter.js';

test('removes templated anchor links', () => {
  const input = '<a href="/path/{{ id }}">Item</a>';
  assert.equal(removeTemplatedLinks(input), 'Item');
});

test('removes templated wikilinks', () => {
  const input = '[[/path/{{ id }}]]';
  assert.equal(removeTemplatedLinks(input), '');
});
