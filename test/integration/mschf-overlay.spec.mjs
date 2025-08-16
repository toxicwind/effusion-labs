import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { buildLean } from '../helpers/eleventy-env.mjs';
import { computeSeed } from '../../lib/mschf-seed.mjs';

test('overlay root exists and carries defaults', async () => {
  const outDir = await buildLean('homepage');
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const doc = new JSDOM(html).window.document;

  const shell = doc.querySelector('#page-shell');
  assert(shell);
  assert.equal(shell.dataset.mschf, 'auto');
  assert.equal(shell.dataset.mschfIntensity, 'lite');
  assert.equal(shell.dataset.mschfSeedMode, 'page');

  const first = shell.firstElementChild;
  assert(first);
  assert.equal(first.id, 'mschf-overlay-root');
  assert.equal(first.getAttribute('aria-hidden'), 'true');
});

test('seed generation modes', () => {
  const s1 = computeSeed('page');
  const s2 = computeSeed('page');
  assert.notEqual(s1, s2);

  const forced = computeSeed('page', '123');
  assert.equal(forced, '123');

  const store = { value: null, getItem(){ return this.value; }, setItem(_, v){ this.value = v; } };
  const session1 = computeSeed('session', undefined, store);
  const session2 = computeSeed('session', undefined, store);
  assert.equal(session1, session2);
});
