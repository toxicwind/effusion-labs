import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const spec = readJSON('plan/build.spec.json')

test('passthrough proposals exist', () => {
  const p = spec.passthrough
  assert.ok(p.includes('src/content/docs/vendor-docs/**'))
  assert.ok(p.includes('src/content/docs/flower/normalized/**'))
  assert.ok(p.includes('src/content/docs/flower/reports/**'))
})

test('brittle harness line captured', () => {
  assert.ok(spec.cleanup && spec.cleanup.line.includes('HEARTBEAT'))
})
