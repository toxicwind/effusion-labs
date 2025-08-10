const test = require('node:test');
const assert = require('node:assert');
const { dailySeed, seededShuffle } = require('../lib/homepage');

test('seed override', () => {
  process.env.HOMEPAGE_SEED = 'TEST';
  assert.strictEqual(dailySeed(), 'TEST');
  delete process.env.HOMEPAGE_SEED;
});

test('seeded shuffle deterministic', () => {
  const arr = [1,2,3,4,5];
  const a = seededShuffle(arr, 'abc');
  const b = seededShuffle(arr, 'abc');
  assert.deepStrictEqual(a, b);
});
