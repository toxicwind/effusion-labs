import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('@photogabble/eleventy-plugin-interlinker/package.json');
const parserPath = join(dirname(pkgPath), 'src', 'wikilink-parser.js');

const ParserModule = await import(parserPath);
const ParserClass = ParserModule.default || ParserModule.WikilinkParser || ParserModule;

// minimal stubs for required constructor params
const noopDeadLinks = { add() {} };
const pageDirectory = { findByLink() { return {}; } };

test('interlinker tolerates non-string document', () => {
  const p = new ParserClass({}, noopDeadLinks, new Map());
  assert.doesNotThrow(() => p.find({}, pageDirectory));
});
