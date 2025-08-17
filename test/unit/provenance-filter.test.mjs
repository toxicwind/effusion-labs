import test from 'node:test';
import assert from 'node:assert/strict';
import filters from '../../lib/filters.js';
const { provenanceSources } = filters;

const sampleRef = '/content/archives/collectables/designer-toys/pop-mart/the-monsters/provenance/pop-mart--the-monsters--labubu--have-a-seat--blind-box--single--15cm--20240712.jsonl';

test('provenanceSources parses JSONL provenance files', () => {
  const sources = provenanceSources(sampleRef);
  assert.ok(Array.isArray(sources), 'returns an array');
  const first = sources[0] || {};
  assert.equal(first.url, '/docs/knowledge/sources/the-monsters/seed-article.md');
});

test('provenanceSources returns [] when file missing', () => {
  const sources = provenanceSources('/missing/file.jsonl');
  assert.deepEqual(sources, []);
});
