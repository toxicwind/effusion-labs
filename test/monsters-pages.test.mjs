import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

let built = false;
function build() {
  if (!built) {
    execSync('npx @11ty/eleventy', { stdio: 'inherit' });
    built = true;
  }
}

test('monsters archive index links to characters, series, and products', () => {
  build();
  const html = fs.readFileSync('_site/archives/collectables/designer-toys/pop-mart/the-monsters/index.html', 'utf8');
  assert.match(html, /characters\/labubu\//);
  assert.match(html, /series\/time-to-chill\//);
  assert.match(html, /products\/pop-mart--the-monsters--labubu--time-to-chill--figure--std--20221031\//);
});

test('character page lists related products', () => {
  build();
  const html = fs.readFileSync('_site/archives/collectables/designer-toys/pop-mart/the-monsters/characters/labubu/index.html', 'utf8');
  assert.match(html, /pop-mart--the-monsters--labubu--time-to-chill--figure--std--20221031/);
});

test('series page lists related products', () => {
  build();
  const html = fs.readFileSync('_site/archives/collectables/designer-toys/pop-mart/the-monsters/series/time-to-chill/index.html', 'utf8');
  assert.match(html, /pop-mart--the-monsters--labubu--time-to-chill--figure--std--20221031/);
});
