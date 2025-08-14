import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const outDir = 'tmp/monsters-build';

rmSync(outDir, { recursive: true, force: true });

function build() {
  execSync('npx @11ty/eleventy --quiet --input=src --output=' + outDir, { stdio: 'inherit' });
}

test('monsters hub lists products and cross-links product and character pages', () => {
  build();
  const hub = readFileSync(path.join(outDir, 'archives', 'collectables', 'designer-toys', 'pop-mart', 'the-monsters', 'index.html'), 'utf8');
  assert.match(hub, /time-to-chill--plush--std--20221031/);

  const product = readFileSync(path.join(outDir, 'archives', 'collectables', 'designer-toys', 'pop-mart', 'the-monsters', 'products', 'pop-mart--the-monsters--labubu--time-to-chill--plush--std--20221031', 'index.html'), 'utf8');
  assert.match(product, /\/archives\/collectables\/designer-toys\/pop-mart\/the-monsters\/characters\/labubu\//);

  const character = readFileSync(path.join(outDir, 'archives', 'collectables', 'designer-toys', 'pop-mart', 'the-monsters', 'characters', 'labubu', 'index.html'), 'utf8');
  assert.match(character, /time-to-chill--plush--std--20221031/);
});
