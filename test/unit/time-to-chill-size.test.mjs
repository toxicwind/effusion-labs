import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const productUrl = new URL('../../src/content/archives/collectables/designer-toys/pop-mart/the-monsters/products/pop-mart--the-monsters--labubu--time-to-chill--plush--std--20221031.json', import.meta.url);
const product = JSON.parse(readFileSync(productUrl, 'utf8'));

// Acceptance example: ensure Time to Chill product declares dimensions
await test('time to chill includes size with height in cm', () => {
  assert.ok(product.size, 'size field should exist');
  assert.equal(product.size.unit, 'cm');
  assert.equal(product.size.h, 37);
});

// Property: height should be positive
await test('time to chill height is positive', () => {
  assert.ok(product.size.h > 0);
});
