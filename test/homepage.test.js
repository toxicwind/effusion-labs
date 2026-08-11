const test = require('node:test');
const assert = require('node:assert');
const { dailySeed, seededShuffle } = require('../lib/seeded');
const { exploreLinks } = require('../lib/homepage');

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

test('dailySeed accepts date', () => {
  const seed = dailySeed('2025-08-09');
  assert.ok(seed.startsWith('2025-08-09'));
});

test('exploreLinks counts exclude index files', () => {
  const collections = {
    projects: [{ filePathStem: 'projects/index' }, { filePathStem: 'projects/a' }],
    concepts: [{ filePathStem: 'concepts/index' }],
  };
  const links = exploreLinks(collections);
  const proj = links.find((l) => l.title === 'Projects');
  const concept = links.find((l) => l.title === 'Concepts');
  assert.strictEqual(proj.count, 1);
  assert.strictEqual(concept.count, 0);
});
