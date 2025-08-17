import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { buildLean } from '../helpers/eleventy-env.mjs';

const productSlug = 'pop-mart--the-monsters--labubu--big-into-energy--blind-box--single--20250425';
const productPath = path.join(
  process.cwd(),
  'src','content','archives','collectables','designer-toys','pop-mart','the-monsters','products',
  `${productSlug}.json`
);
const product = JSON.parse(readFileSync(productPath, 'utf8'));

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

function dom(html) {
  return new JSDOM(html).window.document;
}

test('product page exposes full metadata (acceptance)', async () => {
  const html = await buildProduct();

  const document = dom(html);
  const dl = document.querySelector('[data-testid="spec-sheet"]');
  assert.ok(dl, 'spec sheet rendered');
  const entries = Array.from(dl.querySelectorAll('dt')).map(dt => dt.textContent.trim());
  assert.ok(entries.includes('Brand'), 'brand label present');
  assert.ok(entries.includes('Line'), 'line label present');
  assert.ok(entries.includes('Character'), 'character label present');
  assert.ok(entries.includes('Series'), 'series label present');
  assert.ok(entries.includes('Form'), 'form label present');
  assert.ok(entries.includes('Variant'), 'variant label present');
  assert.ok(entries.includes('Edition'), 'edition label present');
  const chips = dl.querySelectorAll('[data-market]');
  assert.ok(chips.length > 0, 'market chips render');
});

test('price cells are formatted and table parity holds (property)', async () => {
  const html = await buildProduct();
  const document = dom(html);
  const table = document.querySelector('[data-testid="market-table"]');
  assert.ok(table, 'market listings table rendered');
  const rows = table.querySelectorAll('tbody tr');
  assert.equal(rows.length, 1, 'row count matches listings length');
  for (const row of rows) {
    const price = row.querySelector('td:nth-child(2)').textContent.trim();
    assert.match(price, /\b[A-Z]{3}\s+\d+\.\d{2}\b/, 'price format');
  }
});

test('semantic invariants hold (contract)', async () => {
  const html = await buildProduct();
  const document = dom(html);
  const dl = document.querySelector('[data-testid="spec-sheet"]');
  assert.ok(dl);
  const dts = dl.querySelectorAll('dt');
  const dds = dl.querySelectorAll('dd');
  assert.equal(dts.length, dds.length, 'definition list pairs');
  const region = Array.from(dts).find(dt => dt.textContent.trim() === 'Region Lock');
  assert.ok(region, 'region lock label');
  assert.equal(region.nextElementSibling.textContent.trim(), 'No', 'boolean rendered as Yes/No');
  const limited = Array.from(dts).find(dt => dt.textContent.trim() === 'Limited');
  assert.ok(limited, 'limited label present');
  assert.equal(limited.nextElementSibling.textContent.trim(), 'Standard', 'availability uses Standard/Limited');
  const caption = document.querySelector('[data-testid="market-table"] caption');
  assert.match(caption.textContent, /Market Listings/, 'caption contains label');
  const dlMatch = html.match(/<dl[^>]*data-testid="spec-sheet"[\s\S]*?<\/dl>/);
  assert.ok(dlMatch, 'spec sheet present');
  const block = dlMatch[0];
  assert.ok(block.includes('<dt>Brand:</dt><dd>Pop Mart</dd>'));
  assert.ok(block.includes('<dt>Line:</dt><dd>The Monsters</dd>'));
  assert.ok(block.includes('<dt>Character:</dt><dd>Labubu</dd>'));
  assert.ok(block.includes('<dt>Series:</dt><dd>Big Into Energy</dd>'));
  assert.ok(block.includes('<dt>Form:</dt><dd>Blind Box</dd>'));
  assert.ok(block.includes('<dt>Variant:</dt><dd>Single</dd>'));
  assert.ok(block.includes('<dt>Edition:</dt><dd>Collab</dd>'));
  assert.ok(block.includes('<dt>Region Lock:</dt><dd>No</dd>'));
  assert.ok(html.includes('data-testid="markets"'));
  assert.ok(block.includes('<dt>Release Date:</dt><dd><time datetime="2025-04-25">2025-04-25</time></dd>'));
  assert.ok(block.includes('<dt>Availability:</dt><dd>Standard</dd>'));
});

test('rendered prices use ISO code and two decimals (property)', async () => {
  const html = await buildProduct();
  const prices = [...html.matchAll(/\b[A-Z]{3}\s+\d+\.\d{2}\b/g)].map(m => m[0]);
  assert.equal(prices.length, product.market_listings.length, 'price count matches listings');
});

test('table and spec semantics hold (contract)', async () => {
  const html = await buildProduct();
  const dl = html.match(/<dl[^>]*data-testid="spec-sheet"[\s\S]*?<\/dl>/)[0];
  const dtCount = (dl.match(/<dt>/g) || []).length;
  const ddCount = (dl.match(/<dd>/g) || []).length;
  assert.equal(dtCount, ddCount, 'dt and dd counts match');
  assert.ok(!/true|false/.test(dl), 'booleans rendered as Yes/No');

  const tableMatch = html.match(/<table[^>]*data-testid="market-table"[\s\S]*?<\/table>/);
  assert.ok(tableMatch, 'market table present');
  const table = tableMatch[0];
  assert.ok(/<caption>Market Listings<\/caption>/.test(table));
  const rowCount = (table.match(/<tbody>[\s\S]*?<tr/g) || []).length;
  assert.equal(rowCount, product.market_listings.length, 'row count parity');
});
