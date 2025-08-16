import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { buildLean } from '../helpers/eleventy-env.mjs';

test('homepage lists latest entries per section', async () => {
  const outDir = await buildLean('homepage-latest');
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const doc = new JSDOM(html).window.document;
  const sections = ['Projects', 'Concepts', 'Sparks', 'Meta'];
  sections.forEach(name => {
    const h2 = Array.from(doc.querySelectorAll('main h2')).find(h => h.textContent.trim() === name);
    const list = h2.closest('section').querySelector('ul');
    const items = list.querySelectorAll('li');
    assert(items.length >= 1 && items.length <= 3);
  });
});
