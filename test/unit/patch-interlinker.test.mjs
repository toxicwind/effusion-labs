import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

// Directly import the patched source file from node_modules to ensure
// the patch behavior (defensive string coercion) is exercised.
const interlinkerPath = '../../node_modules/@photogabble/eleventy-plugin-interlinker/src/wikilink-parser.js';
const { default: WikilinkParser } = await import(interlinkerPath);

await test('interlinker: find handles non-string document without throwing', () => {
  const parser = new WikilinkParser({}, { add: () => {} }, new Map());

  const domDoc = new JSDOM('<p>[[Link]]</p>').window.document;
  const stubDir = { findByLink: () => ({ found: false }) };
  const cases = [null, undefined, 0, 42, true, false, { a: 1 }, [1, 2, 3], domDoc];
  for (const doc of cases) {
    const out = parser.find(doc, stubDir, 'dummy');
    assert(Array.isArray(out));
  }

  const out = parser.find(domDoc, stubDir, 'dummy');
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Link');
});

