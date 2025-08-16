import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterDeadLinks, TEMPLATE_SYNTAX } from '../../lib/wikilinks/filter-dead-links.js';

await test('filterDeadLinks removes templated links', () => {
  const input = {
    '/archives/{{ id }}/': ['foo.md'],
    '/real/path/': ['bar.md']
  };
  const result = filterDeadLinks(input);
  assert.deepEqual(result, { '/real/path/': ['bar.md'] });
});

await test('result has no templated links', () => {
  const result = filterDeadLinks({
    '/a/{{ b }}/': ['a.md'],
    '/c/': ['c.md']
  });
  Object.keys(result).forEach(link => {
    assert.ok(!TEMPLATE_SYNTAX.test(link));
  });
});

await test('filterDeadLinks does not mutate input', () => {
  const input = { '/a/{{ b }}/': ['a'], '/c/': ['c'] };
  const copy = structuredClone(input);
  filterDeadLinks(input);
  assert.deepEqual(input, copy);
});
