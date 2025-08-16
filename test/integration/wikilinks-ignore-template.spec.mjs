import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLean } from '../helpers/eleventy-env.mjs';

// Acceptance: templated paths are ignored
// Property: real missing wikilinks still emit warnings

test('wikilinks ignore templated paths', async () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await buildLean('wikilinks-ignore-template');
  } finally {
    console.warn = origWarn;
  }
  const templated = warnings.find(w => w.includes('{{') && w.includes('}}'));
  assert.equal(templated, undefined);
  const placeholder = warnings.find(w => w.includes('[[missing-node]]'));
  assert.ok(placeholder);
});
