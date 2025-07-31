const { test } = require('node:test');
const assert = require('node:assert');
const loadPlugins = require('../lib/postcssPlugins');

test('loadPostcssPlugins returns plugin objects', () => {
  const plugins = loadPlugins();
  assert.ok(Array.isArray(plugins));
  assert.ok(plugins.length >= 2);
  plugins.forEach(p => assert.ok(typeof p === 'object'));
});
