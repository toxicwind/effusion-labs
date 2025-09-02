import test from 'node:test';
import { JSDOM } from 'jsdom';

// Directly import the patched source file from node_modules to ensure
// the patch behavior (defensive string coercion) is exercised.
const interlinkerPath = '../../node_modules/@photogabble/eleventy-plugin-interlinker/src/wikilink-parser.js';
const { default: WikilinkParser } = await import(interlinkerPath);

await test('interlinker: find handles non-string document without throwing', () => {
  const parser = new WikilinkParser();

  const domDoc = new JSDOM('<p>[[Link]]</p>').window.document;
  const cases = [null, undefined, 0, 42, true, false, { a: 1 }, [1, 2, 3], domDoc];
  for (const doc of cases) {
    const out = parser.find(doc, '.', 'dummy');
    if (!Array.isArray(out)) {
      throw new Error(`Expected array for doc=${String(doc)}, got ${typeof out}`);
    }
  }
});

