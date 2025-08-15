import test from 'node:test';
import assert from 'node:assert';
import applyPatch from '../lib/applyPatch.js';

test('applyPatch inserts and deletes segments', () => {
  const original = 'abcdef';
  const patches = [
    { start: 2, deleteCount: 2, insert: 'XY' },
    { start: 5, deleteCount: 0, insert: 'Z' }
  ];
  const result = applyPatch(original, patches);
  assert.strictEqual(result, 'abXYeZf');
});

test('applyPatch throws on overlapping patches', () => {
  const original = 'abc';
  const patches = [
    { start: 1, deleteCount: 2, insert: 'X' },
    { start: 2, deleteCount: 0, insert: 'Y' }
  ];
  assert.throws(() => applyPatch(original, patches));
});
