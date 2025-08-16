import test from 'node:test';
import assert from 'node:assert';
import indexData from '../../src/index.11tydata.js';

test('projects computed picks latest entries by date', () => {
  const unsorted = [
    { date: new Date('2025-01-01'), data: { title: 'old' } },
    { date: new Date('2025-01-03'), data: { title: 'latest' } },
    { date: new Date('2025-01-02'), data: { title: 'mid' } },
    { date: new Date('2024-12-31'), data: { title: 'older' } }
  ];
  const result = indexData.eleventyComputed.projects({ collections: { projects: unsorted } });
  assert.strictEqual(result.length, 3);
  assert.deepStrictEqual(result.map(i => i.data.title), ['latest', 'mid', 'old']);
});
