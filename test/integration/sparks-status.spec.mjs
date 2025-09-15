import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildLean } from '../helpers/eleventy-env.mjs'

test('spark listings reveal status text', async () => {
  const outDir = await buildLean('sparks-status')
  const htmlPath = path.join(outDir, 'sparks', 'index.html')
  const html = readFileSync(htmlPath, 'utf8')
  assert.match(html, /\[draft\]/)
})
