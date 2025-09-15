import test from 'node:test'
import assert from 'node:assert/strict'
import nav from '../src/_data/nav.js'

test('navigation items are sequentially ordered', () => {
  nav.forEach((item, idx) => {
    assert.equal(item.order, idx + 1)
  })
})
