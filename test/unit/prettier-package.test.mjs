import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));

test('prettier pinned version and format script', () => {
  const { devDependencies = {}, scripts = {} } = pkg;
  assert.strictEqual(devDependencies.prettier, '3.3.3');
  assert.ok(scripts.format?.includes('prettier'));
});
