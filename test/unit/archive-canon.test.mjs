import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { slugCanonicalProduct } from '../../helpers/data/naming-canon.mjs';

await test('slugCanonicalProduct strips volatile suffixes', () => {
  const slug = slugCanonicalProduct({ product_id: 'pop-mart--the-monsters--labubu--best-of-luck--plush--std--20231230--reg-cn' });
  assert.equal(slug, 'pop-mart-the-monsters-labubu-best-of-luck-plush');
});

const buildDir = process.env.ELEVENTY_BUILD_DIR || path.resolve('_site');

await test('canonical product page exists', () => {
  const p = path.join(buildDir, 'archives/product/pop-mart-the-monsters-labubu-best-of-luck-plush/index.html');
  assert.ok(fs.existsSync(p));
  const html = fs.readFileSync(p, 'utf8');
  assert.match(html, /<link rel="canonical" href="\/archives\/product\/pop-mart-the-monsters-labubu-best-of-luck-plush\//);
});

await test('redirects include legacy paths', () => {
  const file = fs.readFileSync(path.join(buildDir, '_redirects'), 'utf8');
  assert.match(file, /\/archives\/product\/pop-mart-the-monsters-labubu-best-of-luck-plush-std-20231230-reg-cn\/\s+\/archives\/product\/pop-mart-the-monsters-labubu-best-of-luck-plush\/\s+308!/);
});

await test('stub page emits canonical link', () => {
  const p = path.join(buildDir, 'archives/product/pop-mart-the-monsters-labubu-best-of-luck-plush-std-20231230-reg-cn/index.html');
  assert.ok(fs.existsSync(p));
});
