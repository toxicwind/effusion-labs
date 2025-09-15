import { test } from 'node:test'
import assert from 'node:assert/strict'
import pkg from '@photogabble/eleventy-plugin-interlinker/package.json' assert { type: 'json' }

await test('interlinker plugin is at least v1.1.0', () => {
  const [major, minor] = pkg.version.split('.').map(Number)
  const ok = major > 1 || (major === 1 && minor >= 1)
  assert.ok(ok, `expected >=1.1.0, got ${pkg.version}`)
})
