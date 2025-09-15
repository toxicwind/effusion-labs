import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' })
}

test('dry run leaves working tree and HEAD unchanged', () => {
  const headBefore = run('git rev-parse HEAD').trim()
  const statusBefore = run('git status --porcelain')
  assert.strictEqual(statusBefore.trim(), '')
  const output = run('node plan/make-plan.mjs')
  assert.ok(output.includes('DRY RUN COMPLETE'))
  const headAfter = run('git rev-parse HEAD').trim()
  const statusAfter = run('git status --porcelain')
    .split('\n')
    .filter(l => l && !l.startsWith('?? var/'))
    .join('\n')
  assert.strictEqual(headAfter, headBefore)
  assert.strictEqual(statusAfter, '')
  const required = [
    'var/inspect/tree.before.txt',
    'var/inspect/refscan.txt',
    'var/inspect/writers.txt',
    'var/inspect/unref.txt',
    'var/plan/move-map.tsv',
    'var/plan/src-move-map.tsv',
    'var/plan/rewrites.sed',
    'var/plan/apply-moves.sh',
    'var/plan/apply-rewrites.sh',
    'var/plan/apply-build.sh',
    'var/plan/apply-src.sh',
    'var/reports/plan.md',
    'var/reports/plan.json',
  ]
  for (const f of required) {
    assert.ok(fs.existsSync(f), `${f} missing`)
  }
})
