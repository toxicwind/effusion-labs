import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildLean } from '../helpers/eleventy-env.mjs';

const slug = 'pop-mart--the-monsters--labubu--big-into-energy--blind-box--single--20250425';

async function build() {
  const outDir = await buildLean('product-template');
  const file = path.join(
    outDir,
    'archives','collectables','designer-toys','pop-mart','the-monsters','products',
    slug,
    'index.html'
  );
  return readFileSync(file, 'utf8');
}

test('products template builds correct heading (acceptance)', async () => {
  const html = await build();
  const expected = `<h1 class="text-2xl font-bold mb-2">${slug}</h1>`;
  assert.ok(html.includes(expected), 'heading renders product id');
});

test('availability renders human readable text (property)', async () => {
  const html = await build();
  const match = html.match(/<dt>Availability:<\/dt><dd>([^<]+)<\/dd>/);
  assert.ok(match, 'availability row present');
  assert.ok(['Standard','Limited'].includes(match[1]), 'availability uses Standard/Limited');
});

test('product heading is unique per page (contract)', async () => {
  const html = await build();
  const heading = `<h1 class="text-2xl font-bold mb-2">${slug}</h1>`;
  const count = html.split(heading).length - 1;
  assert.equal(count, 1, 'product heading unique');
});
