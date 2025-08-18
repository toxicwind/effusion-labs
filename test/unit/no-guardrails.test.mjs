import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';

test('repository contains no legacy test-with-guardrails script', () => {
  const result = execSync('rg "test-with-guardrails\\.sh" || true').toString().trim();
  assert.strictEqual(result, '');
});
