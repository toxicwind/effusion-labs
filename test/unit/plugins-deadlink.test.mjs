import { test } from 'node:test';
import assert from 'node:assert/strict';
import getPlugins from '../../lib/plugins.js';

// Acceptance example: interlinker plugin disables dead link report
await test('interlinker disables dead link report', () => {
  const [plugin, opts] = getPlugins()[0];
  assert.equal(typeof plugin, 'function');
  assert.equal(opts.deadLinkReport, 'none');
});

// Property: plugin list entries are arrays with function at index 0
await test('plugin list structure', () => {
  const plugins = getPlugins();
  assert.ok(Array.isArray(plugins), 'plugins should be an array');
  plugins.forEach(entry => {
    assert.ok(Array.isArray(entry), 'each plugin entry should be an array');
    assert.equal(typeof entry[0], 'function', 'plugin should be a function');
  });
});

// Contract: interlinker options include expected defaults
await test('interlinker options contract', () => {
  const [, opts] = getPlugins()[0];
  assert.deepEqual(
    { defaultLayout: 'layouts/embed.njk', deadLinkReport: 'none' },
    { defaultLayout: opts.defaultLayout, deadLinkReport: opts.deadLinkReport }
  );
});
