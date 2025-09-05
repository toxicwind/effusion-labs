import { test } from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.INTERLINKER_CANARY === '1';

await test('canary: .match on non-string would throw (pre-patch)', { skip: !enabled }, () => {
  const bad = 42; // number instead of string
  assert.throws(() => bad.match(/x/), { name: 'TypeError' });
});

