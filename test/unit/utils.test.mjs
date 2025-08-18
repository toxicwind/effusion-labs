import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import utils from '../../lib/utils.js';
const { ordinalSuffix, readFileCached } = utils;

// Acceptance example: negative numbers yield correct suffix
await test('ordinalSuffix handles negative numbers', () => {
  assert.equal(ordinalSuffix(-1), 'st');
});

// Property: teen values always use "th" suffix
await test('ordinalSuffix uses "th" for teens', () => {
  [11, 12, 13, -11, -12, -13].forEach((n) => {
    assert.equal(ordinalSuffix(n), 'th');
  });
});

// Contract: missing files return null from cache reader
await test('readFileCached returns null for nonexistent path', () => {
  const p = path.join(process.cwd(), 'nonexistent-file.txt');
  assert.equal(readFileCached(p), null);
});
