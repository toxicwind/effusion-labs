import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import runEleventy from './helpers/eleventy.js';

test('monsters hub lists products and cross-links product and character pages', () => {
  const outDir = runEleventy('monsters-hub');
  const hub = readFileSync(path.join(outDir, 'archives', 'collectables', 'designer-toys', 'pop-mart', 'the-monsters', 'index.html'), 'utf8');
  assert.match(hub, /time-to-chill--plush--std--20221031/);

  const product = readFileSync(path.join(outDir, 'archives', 'collectables', 'designer-toys', 'pop-mart', 'the-monsters', 'products', 'pop-mart--the-monsters--labubu--time-to-chill--plush--std--20221031', 'index.html'), 'utf8');
  assert.match(product, /\/archives\/collectables\/designer-toys\/pop-mart\/the-monsters\/characters\/labubu\//);

  const character = readFileSync(path.join(outDir, 'archives', 'collectables', 'designer-toys', 'pop-mart', 'the-monsters', 'characters', 'labubu', 'index.html'), 'utf8');
  assert.match(character, /time-to-chill--plush--std--20221031/);
});
