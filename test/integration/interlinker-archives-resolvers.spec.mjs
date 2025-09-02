import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildLean } from '../helpers/eleventy-env.mjs';

test('wikilinks: custom archive resolvers render anchors with correct hrefs', async () => {
  const outDir = await buildLean('interlinker-archives-resolvers');
  const htmlPath = path.join(outDir, 'test', 'interlink-archives', 'index.html');
  assert.ok(fs.existsSync(htmlPath), 'built HTML exists for test page');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Basic presence
  assert.ok(html.includes('interlink--series'), 'series anchor rendered');
  assert.ok(html.includes('interlink--character'), 'character anchor rendered');
  assert.ok(html.includes('interlink--product'), 'product anchor rendered');

  // Expected hrefs (derived from archives.mjs buildUrl convention)
  assert.ok(
    html.includes('/archives/collectables/designer-toys/pop-mart/the-monsters/series/lets-checkmate/'),
    'series link URL looks correct'
  );

  assert.ok(
    html.includes('/archives/collectables/designer-toys/pop-mart/the-monsters/characters/labubu/'),
    'character link URL looks correct'
  );

  assert.ok(
    html.match(/\/archives\/collectables\/designer-toys\/pop-mart\/the-monsters\/products\/lab010\//),
    'product link URL looks correct (matches LAB010)'
  );
});

