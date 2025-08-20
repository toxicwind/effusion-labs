import test from 'node:test';
import assert from 'node:assert';
import cp from 'node:child_process';
import fs from 'node:fs';

const { execSync } = cp;

const nodeShim = 'bin/node';

// Acceptance example: node shim outputs same version as system node
export const versionTest = test('node shim version matches system node', () => {
  const expected = execSync('node --version').toString().trim();
  const actual = execSync(`${nodeShim} --version`).toString().trim();
  assert.strictEqual(actual, expected);
});

// Contract: node shim is executable
export const execTest = test('node shim is executable', () => {
  const stats = fs.statSync(nodeShim);
  assert.ok(stats.mode & 0o111, 'node shim should be executable');
});

// Structural property: shim does not reference missing llm-constants script
export const propertyTest = test('node shim lacks llm-constants reference', () => {
  const content = fs.readFileSync(nodeShim, 'utf8');
  assert.ok(!content.includes('llm-constants.sh'));
});
