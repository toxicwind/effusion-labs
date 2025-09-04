import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResolvers } from '../../lib/interlinkers/resolvers.mjs';

// Minimal context with archive products
const ctx = {
  data: {
    archiveProducts: [
      { data: { slugCanonical: 'alpha', productSlug: 'alpha-prod', title: 'Alpha', legacyPaths: ['/archives/product/alpha-old/'], slugAliases: ['a-one'] } },
    ],
  },
};

const map = createResolvers();
const product = map.get('product');

await test('product: resolves alias to canonical URL', () => {
  const html = product({ name: 'a-one' }, ctx);
  assert.match(html, /href="\/archives\/product\/alpha\//);
});

await test('product: resolves legacy to canonical URL', () => {
  const html = product({ name: 'alpha-old' }, ctx);
  assert.match(html, /href="\/archives\/product\/alpha\//);
});

await test('omitted kind falls back to priority and soft-links when unknown', () => {
  const omitted = map.get('omitted');
  const html = omitted({ name: 'not-here' }, ctx);
  assert.match(html, /interlink--soft/);
});

