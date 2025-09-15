import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

function ensurePlan() {
  if (!fs.existsSync('var/reports/plan.md')) {
    execSync('node plan/make-plan.mjs', { encoding: 'utf8' })
  }
}

test('edge cases section exists', () => {
  ensurePlan()
  const md = fs.readFileSync('var/reports/plan.md', 'utf8')
  assert.ok(md.includes('Edge Cases (as needed, evidence-driven)'))
  const json = JSON.parse(fs.readFileSync('var/reports/plan.json', 'utf8'))
  assert.ok(Array.isArray(json.edgeCases))
  if (json.publicUrlChanges && json.publicUrlChanges.length) {
    assert.ok(md.includes('public URL'))
  }
})
