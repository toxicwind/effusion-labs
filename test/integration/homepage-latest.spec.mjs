import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { buildLean } from '../helpers/eleventy-env.mjs'

test('homepage work list mixes types', async () => {
  const outDir = await buildLean('homepage-latest')
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8')
  const doc = new JSDOM(html).window.document
  const items = Array.from(doc.querySelectorAll('#work-list > li'))
  assert(items.length >= 6 && items.length <= 9)
  const types = new Set(items.map(li => li.dataset.type))
  const valid = ['project', 'concept', 'spark', 'meta']
  valid.forEach(t => assert(types.has(t)))
  // Property: each item tagged with a valid type
  items.forEach(li => assert(valid.includes(li.dataset.type)))
})
