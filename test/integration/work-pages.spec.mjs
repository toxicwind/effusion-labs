import test from 'node:test'
import assert from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { buildLean } from '../helpers/eleventy-env.mjs'

test('work pages build and latest redirects', async () => {
  const outDir = await buildLean('work-pages')
  const pages = [
    'work/index.html',
    'work/latest/index.html',
    'work/drop/index.html',
    'work/block-ledger/index.html',
    'work/raw-socket-report/index.html',
  ]
  pages.forEach(p => {
    assert(existsSync(path.join(outDir, p)), `${p} missing`)
  })
  const latest = readFileSync(
    path.join(outDir, 'work/latest/index.html'),
    'utf8'
  )
  assert(latest.includes('<meta http-equiv="refresh"'))
})
