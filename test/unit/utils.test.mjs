import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import utils from '../../helpers/utils/utils-node.mjs';

// Destructure the functions to be tested
const { ordinalSuffix, readFileCached } = utils;

//--- Tests for ordinalSuffix --------------------------------------------------

// Acceptance test: Basic cases
await test('ordinalSuffix handles basic single-digit numbers', () => {
  assert.equal(ordinalSuffix(1), 'st');
  assert.equal(ordinalSuffix(2), 'nd');
  assert.equal(ordinalSuffix(3), 'rd');
  assert.equal(ordinalSuffix(4), 'th');
});

// Edge Case: Negative numbers
await test('ordinalSuffix handles negative numbers correctly', () => {
  assert.equal(ordinalSuffix(-1), 'st');
  assert.equal(ordinalSuffix(-2), 'nd');
  assert.equal(ordinalSuffix(-22), 'nd');
});

// Contract: Numbers ending in 11, 12, or 13 use the "th" suffix
await test('ordinalSuffix uses "th" for all teen numbers', () => {
  const teens = [11, 12, 13, -11, -12, -13, 111, 112, 113];
  for (const n of teens) {
    assert.equal(ordinalSuffix(n), 'th', `Failed for number ${n}`);
  }
});

// Property: The function returns a valid suffix for a range of dates
await test('ordinalSuffix returns a valid suffix for all days in a month', () => {
  for (let i = 1; i <= 31; i++) {
    assert.match(
      ordinalSuffix(i),
      /^(st|nd|rd|th)$/,
      `Invalid suffix for ${i}`
    );
  }
});

//--- Tests for readFileCached -------------------------------------------------

// Contract: Reading a nonexistent file should return null
await test('readFileCached returns null for a nonexistent file path', () => {
  const p = path.join(process.cwd(), 'a-file-that-does-not-exist.txt');
  assert.equal(readFileCached(p), null);
});