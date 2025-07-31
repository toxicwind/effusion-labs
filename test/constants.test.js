const assert = require('node:assert');
const { test } = require('node:test');
const { CONTENT_AREAS, baseContentPath } = require('../lib/constants');

test('content area constants are defined', () => {
  assert.ok(Array.isArray(CONTENT_AREAS));
  assert.ok(CONTENT_AREAS.includes('sparks'));
  assert.strictEqual(typeof baseContentPath, 'string');
});
