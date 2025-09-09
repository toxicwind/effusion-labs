import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

test('only plan and test/plan modified; plan files small', () => {
  const lines = execSync('git status --porcelain', {encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const filtered = lines.filter(l => !l.startsWith('?? var/'));
  const bad = filtered.filter(l => {
    const file = l.slice(3);
    return !(file.startsWith('plan/') || file.startsWith('test/plan/'));
  });
  assert.strictEqual(bad.length, 0);
  const planFiles = [
    'plan/relocate.spec.json',
    'plan/rewrites.spec.json',
    'plan/build.spec.json',
    'plan/src-normalize.spec.json',
    'plan/make-plan.mjs'
  ];
  for (const f of planFiles) {
    const stat = fs.statSync(f);
    assert.ok(stat.size < 131072, `${f} too large`);
    const buf = fs.readFileSync(f);
    assert.ok(!buf.includes(0), `${f} not text`);
  }
});
