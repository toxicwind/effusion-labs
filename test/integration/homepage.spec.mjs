import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { buildLean } from '../helpers/eleventy-env.mjs';

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stats = statSync(p);
    if (stats.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

test('homepage hero and sections', async () => {
  const outDir = await buildLean('homepage');
  const htmlPath = path.join(outDir, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Hero
  const h1 = doc.querySelector('h1');
  assert.equal(h1.textContent.trim(), 'Experimental R&D you can actually use.');
  assert.match(html, /Prototypes, systems, and notes from the lab\./);
  const ctaLatest = Array.from(doc.querySelectorAll('a')).find(a => a.textContent.trim() === 'See the latest drop');
  assert(ctaLatest);
  assert.equal(ctaLatest.getAttribute('href'), '/work/latest');
  const ctaExplore = Array.from(doc.querySelectorAll('a')).find(a => a.textContent.trim() === 'Explore the lab');
  assert(ctaExplore);
  assert.equal(ctaExplore.getAttribute('href'), '/work');
  const bento = doc.querySelector('.bento');
  assert(bento);
  assert.equal(bento.querySelectorAll('a').length, 3);
  assert(!/· unknown ·/.test(html));

  // Skip link
  const skip = doc.querySelector('a.skip-link');
  assert(skip);
  assert.equal(skip.getAttribute('href'), '#main');
  assert(doc.getElementById('main'));

  // Section checks
  const headers = Array.from(doc.querySelectorAll('main h2')).map(h => h.textContent.trim());
  ['Projects','Concepts','Sparks','Meta'].forEach(name => assert(headers.includes(name)));

  ['Projects','Concepts','Sparks','Meta'].forEach(name => {
    const h2 = Array.from(doc.querySelectorAll('main h2')).find(h => h.textContent.trim() === name);
    const section = h2.closest('section');
    const list = section.querySelector('ul');
    const items = list.querySelectorAll('li');
    assert(items.length <= 3);
    const cls = list.getAttribute('class') || '';
    assert(!/(?:grid|columns-|col-)/.test(cls));
    items.forEach(li => {
      assert.strictEqual(li.querySelectorAll('time').length, 0);
      assert.strictEqual(li.querySelectorAll('.tag').length, 0);
    });
  });

  // Open Questions absence
  assert(!/Open Questions/i.test(html));
  const paths = walk(outDir);
  paths.forEach(p => {
    assert(!p.includes('open-questions'));
    if (p.endsWith('.html')) {
      const c = readFileSync(p, 'utf8');
      assert(!/Open Questions/i.test(c));
    }
  });
});
