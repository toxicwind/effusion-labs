import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArchiveResolvers } from '../../config/interlinkers/archives-resolvers.mjs';

const ctx = {
  data: {
    archiveProducts: [
      {
        data: {
          slugCanonical: 'alpha',
          canonicalUrl: '/archives/product/alpha/',
          slugAliases: ['a-one'],
          legacyPaths: ['/archives/product/alpha-old/'],
          productSlug: 'alpha-prod',
          title: 'Alpha',
        },
      },
    ],
  },
};

const map = createArchiveResolvers();
const product = map.get('product');

await test('resolves slug alias to canonical URL', () => {
  const html = product({ name: 'a-one' }, ctx);
  assert.match(html, /href="\/archives\/product\/alpha\//);
});

await test('resolves legacy path slug to canonical URL', () => {
  const html = product({ name: 'alpha-old' }, ctx);
  assert.match(html, /href="\/archives\/product\/alpha\//);
});

await test('unresolved product yields soft link', () => {
  const html = product({ name: 'unknown' }, ctx);
  assert.match(html, /interlink--soft/);
});

