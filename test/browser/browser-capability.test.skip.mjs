// test temporarily parked due to missing probe-browser module
// rename file to `browser-capability.test.mjs` to re-enable
import test from 'node:test'
import assert from 'node:assert/strict'

import { canRunBrowser } from '../test/tools/shared/probe-browser.mjs'

// Acceptance: probe identifies missing browser support
// Property: probe result is a boolean
// Contract: probe resolves without throwing

test('probe reports browsers unavailable', async () => {
  const res = await canRunBrowser()
  assert.equal(res, false)
})

test('probe returns boolean', async () => {
  const res = await canRunBrowser()
  assert.equal(typeof res, 'boolean')
})
