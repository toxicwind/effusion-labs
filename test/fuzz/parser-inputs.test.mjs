import { test } from 'node:test';
import assert from 'node:assert/strict';
import HTMLLinkParser from '@photogabble/eleventy-plugin-interlinker/src/html-link-parser.js';
import WikilinkParser from '@photogabble/eleventy-plugin-interlinker/src/wikilink-parser.js';

const dummyPageDirectory = { findByLink: () => ({ found: false }) };
const deadLinks = { add: () => {}, clear: () => {} };

await test('HTMLLinkParser.find does not throw on non-string input', () => {
  const p = new HTMLLinkParser(deadLinks);
  for (const v of [null, undefined, 42, { a: 1 }, [1,2,3]]) {
    assert.doesNotThrow(() => p.find(v, dummyPageDirectory));
  }
});

await test('WikilinkParser.find does not throw on non-string input', () => {
  const parser = new WikilinkParser({ resolvingFns: new Map() }, deadLinks, new Map());
  for (const v of [null, undefined, 42, { a: 1 }, [1,2,3]]) {
    assert.doesNotThrow(() => parser.find(v, dummyPageDirectory));
  }
});

