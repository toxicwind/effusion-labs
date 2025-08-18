import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordinalSuffix } from '../../lib/utils.js';

// Acceptance example: ordinalSuffix returns 'st' for 1
await test('ordinalSuffix(1) returns st', () => {
  assert.equal(ordinalSuffix(1), 'st');
});

// Property: ordinalSuffix outputs a valid suffix for 1..31
await test('ordinalSuffix emits valid suffix for 1..31', () => {
  for (const i of Array.from({ length: 31 }, (_, n) => n + 1)) {
    assert.match(ordinalSuffix(i), /^(st|nd|rd|th)$/);
  }
});

// Contract: numbers ending in 11,12,13 use th suffix
await test('ordinalSuffix handles teens with th', () => {
  for (const n of [11, 12, 13]) {
    assert.equal(ordinalSuffix(n), 'th');
  }
});
