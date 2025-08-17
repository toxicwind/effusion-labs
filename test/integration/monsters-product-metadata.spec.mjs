import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildLean } from '../helpers/eleventy-env.mjs';

const productSlug = 'pop-mart--the-monsters--labubu--big-into-energy--blind-box--single--20250425';

async function buildProduct() {
  const outDir = await buildLean('product-metadata');
  const file = path.join(
    outDir,
    'archives','collectables','designer-toys','pop-mart','the-monsters','products',
    productSlug,
    'index.html'
  );
  return readFileSync(file, 'utf8');
}

test('product page exposes full metadata (acceptance)', async () => {
  const html = await buildProduct();
  const block = html.match(/<dl[^>]*>([\s\S]*?)<\/dl>/)[0];
  assert.ok(block.includes('<dt>Brand:</dt><dd>pop-mart</dd>'));
  assert.ok(block.includes('<dt>Line:</dt><dd>the-monsters</dd>'));
  assert.ok(block.includes('<dt>Character:</dt><dd>labubu</dd>'));
  assert.ok(block.includes('<dt>Series:</dt><dd>big-into-energy</dd>'));
  assert.ok(block.includes('<dt>Variant:</dt><dd>single</dd>'));
  assert.ok(block.includes('<dt>Markets:</dt><dd>US</dd>'));
  assert.ok(block.includes('<dt>Price:</dt><dd>USD 27.99</dd>'));
  assert.ok(block.includes('<dt>Limited:</dt><dd>false</dd>'));
});

test('price displays with currency and two decimals (property)', async () => {
  const html = await buildProduct();
  const block = html.match(/<dl[^>]*>([\s\S]*?)<\/dl>/)[0];
  const priceMatch = block.match(/Price:<\/dt><dd>USD\s*(\d+\.\d{2})/);
  assert.ok(priceMatch, 'price format with two decimals');
});


test('metadata block matches snapshot (contract)', async () => {
  const html = await buildProduct();
  const m = html.match(/<dl[^>]*>([\s\S]*?)<\/dl>/);
  assert.ok(m, 'metadata block exists');
  const block = m[0].replace(/\s+/g, ' ').trim();
  const expected = '<dl class="grid grid-cols-2 gap-1"> <dt>Brand:</dt><dd>pop-mart</dd> <dt>Line:</dt><dd>the-monsters</dd> <dt>Character:</dt><dd>labubu</dd> <dt>Series:</dt><dd>big-into-energy</dd> <dt>Form:</dt><dd>blind-box</dd> <dt>Variant:</dt><dd>single</dd> <dt>Edition:</dt><dd>collab</dd> <dt>Region Lock:</dt><dd>false</dd> <dt>Markets:</dt><dd>US</dd> <dt>Release Date:</dt><dd>2025-04-25</dd> <dt>Price:</dt><dd>USD 27.99</dd> <dt>Limited:</dt><dd>false</dd> <dt>Confidence:</dt><dd>0.45</dd> <dt>Notes:</dt><dd>Seeded from initial article; requires re-research.</dd> </dl>';
  assert.equal(block, expected);
});

