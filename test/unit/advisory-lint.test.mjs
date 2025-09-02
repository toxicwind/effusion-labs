import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('C1: Advisory lint report is generated (non-blocking)', () => {
  const script = path.join('tools','lint-archive-namespace.mjs');
  cp.execFileSync(process.execPath, [script], { stdio: 'ignore' });
  const out = path.join('artifacts','reports','archive-namespace-advisory.json');
  assert.ok(fs.existsSync(out), 'advisory report exists');
  const payload = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.ok('generatedAt' in payload && Array.isArray(payload.findings), 'payload shape ok');
});

