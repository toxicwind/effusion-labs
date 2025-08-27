import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// Resolve the package entry and walk to the parser source. This avoids relying on
// package.json being exported.
const entryPath = require.resolve('@photogabble/eleventy-plugin-interlinker');
const parserPath = join(dirname(entryPath), 'src', 'wikilink-parser.js');

const ParserModule = await import(parserPath);
const ParserClass = ParserModule.default || ParserModule.WikilinkParser || ParserModule;

// minimal stubs for required constructor params
const noopDeadLinks = { add() {} };
const pageDirectory = { findByLink() { return {}; } };

test('interlinker tolerates non-string document', () => {
  const p = new ParserClass({}, noopDeadLinks, new Map());
  assert.doesNotThrow(() => p.find({}, pageDirectory));
});
