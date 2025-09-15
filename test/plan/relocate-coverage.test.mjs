import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

function ensurePlan() {
  if (!fs.existsSync('var/plan/move-map.tsv')) {
    execSync('node plan/make-plan.mjs', { encoding: 'utf8' })
  }
}

test('relocate spec declares doc intents', () => {
  const spec = JSON.parse(fs.readFileSync('plan/relocate.spec.json', 'utf8'))
  const intents = spec.intents.map(i => i.from)
  ;[
    'docs/**',
    'docs/vendor/**',
    'docs/vendors/**',
    'flower_reports_showcase/**',
  ].forEach(p => assert.ok(intents.includes(p)))
})

test('move-map has rows when source dirs exist', () => {
  ensurePlan()
  const moveMap = fs.readFileSync('var/plan/move-map.tsv', 'utf8').trim()
  const hasDocs = fs.existsSync('docs')
  const hasFlower = fs.existsSync('flower_reports_showcase')
  if (hasDocs || hasFlower) {
    assert.ok(moveMap.length > 0)
  } else {
    assert.ok(fs.existsSync('var/plan/move-map.tsv'))
  }
})
