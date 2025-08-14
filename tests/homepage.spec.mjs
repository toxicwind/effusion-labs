import test from 'node:test';
import assert from 'node:assert';
import { rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const outDir = 'tmp/test-build';

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stats = statSync(p);
    if (stats.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

test('homepage integrates copy and sections', () => {
  rmSync(outDir, { recursive: true, force: true });
  execSync(`npx @11ty/eleventy --quiet --input=src --output=${outDir}`, { stdio: 'inherit' });
  const htmlPath = path.join(outDir, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Copy integration
  assert.match(html, /Art · Culture · Innovation/);
  assert.match(html, /Where experimental ideas meet practical prototypes\./);
  assert.match(html, /Explore the projects, concepts, and sparks shaping tomorrow’s creative technology\./);
  assert.match(html, /Explore the Interactive Concept Map/);
  assert.match(html, /Navigate the living knowledge graph that links every spark, concept, and project in the lab\./);

  // CTAs
  const latest = Array.from(doc.querySelectorAll('a[href="/projects/"]')).find(a => a.textContent.trim() === 'View Latest Work');
  assert(latest);
  const map = Array.from(doc.querySelectorAll('a[href="/map/"]')).find(a => a.textContent.trim() === 'Launch the Map');
  assert(map);

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
