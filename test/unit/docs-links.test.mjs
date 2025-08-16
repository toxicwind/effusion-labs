import { readFileSync } from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const execAsync = promisify(exec);
const docsLinksCmd = 'npm run docs:links';
const lockfileUrl = new URL('../../package-lock.json', import.meta.url);

// Acceptance example: run docs:links and ensure no broken links reported
await test('docs:links reports no broken links', async () => {
  const { stdout } = await execAsync(docsLinksCmd, { encoding: 'utf8' });
  assert.ok(!stdout.includes('[✗]'), 'should not report broken links');
  assert.match(stdout, /\d+ links checked/);
});

// Property/contract: package-lock.json has a lockfileVersion
await test('package-lock.json defines lockfileVersion', async () => {
  const lock = JSON.parse(readFileSync(lockfileUrl, 'utf8'));
  assert.ok(lock.lockfileVersion >= 1, 'lockfileVersion should be >= 1');
});
