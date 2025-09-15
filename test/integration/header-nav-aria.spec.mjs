import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildLean } from '../helpers/eleventy-env.mjs'

// Build the site and ensure primary navigation exposes an accessible landmark label
// This reflects the "Semantics" mode with trait emphasis on meta-as-content and legibility

test('home page header includes primary nav landmark', async () => {
  const outDir = await buildLean('header-nav-aria')
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8')
  const matches = [
    ...html.matchAll(/<nav[^>]*aria-label="Primary navigation"/g),
  ]
  assert.equal(matches.length, 2) // mobile dropdown and desktop menu
})
