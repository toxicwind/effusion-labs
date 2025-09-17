import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const run = script =>
  execFileSync('bash', ['-lc', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

test('retry_exec falls back to the first available executable', () => {
  const output = run(`
    set -euo pipefail
    source ./bin/_lib.sh
    retry_exec "%s\\n" hi -- /nonexistent "$(command -v printf)"
  `)

  assert.equal(output, 'hi\n')
})

test('retry_exec preserves literal -- arguments before the separator', () => {
  const output = run(`
    set -euo pipefail
    source ./bin/_lib.sh
    retry_exec "%s %s\\n" "--" "value" -- "$(command -v printf)"
  `)

  assert.equal(output, '-- value\n')
})

test('retry_exec errors when the separator is missing', () => {
  try {
    run(`
      set -euo pipefail
      source ./bin/_lib.sh
      retry_exec foo bar
    `)
    assert.fail(
      'retry_exec should exit with an error when the separator is absent'
    )
  } catch (err) {
    assert.equal(err.status, 1)
    assert.match(err.stderr, /missing '--' separator/)
  }
})
