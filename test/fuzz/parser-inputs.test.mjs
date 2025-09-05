import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const MOD = path.join(process.cwd(), 'node_modules', '@photogabble', 'eleventy-plugin-interlinker', 'src');
const HTMLLinkParser = (await import(pathToFileURL(path.join(MOD, 'html-link-parser.js')).href)).default;
const WikilinkParser = (await import(pathToFileURL(path.join(MOD, 'wikilink-parser.js')).href)).default;

const dummyPageDirectory = { findByLink: () => ({ found: false }) };
const deadLinks = { add: () => {}, clear: () => {} };

await test('HTMLLinkParser.find does not throw on non-string input', () => {
  const p = new HTMLLinkParser(deadLinks);
  const domLike = { innerHTML: "<a href='/ok'>ok</a>" };
  for (const v of [null, undefined, 42, { a: 1 }, [1,2,3], domLike]) {
    assert.doesNotThrow(() => p.find(v, dummyPageDirectory));
  }
});

await test('WikilinkParser.find does not throw on non-string input', () => {
  const parser = new WikilinkParser({ resolvingFns: new Map() }, deadLinks, new Map());
  const domLike = { outerHTML: "<div>[[alpha]]</div>" };
  for (const v of [null, undefined, 42, { a: 1 }, [1,2,3], domLike]) {
    assert.doesNotThrow(() => parser.find(v, dummyPageDirectory));
  }
});
