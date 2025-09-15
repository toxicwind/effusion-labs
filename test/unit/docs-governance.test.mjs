import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const README = 'README.md'
const AGENTS = 'AGENTS.md'

function file(s) {
  return fs.readFileSync(s, 'utf8')
}

test('B1: README contains "Archive Dynamics by Default" section and examples', () => {
  const readme = file(README)
  assert.match(
    readme,
    /\n##?\s*Archive Dynamics by Default/i,
    'section heading present'
  )
  // namespace contract
  assert.match(readme, /namespace\s+contract/i, 'describes namespace contract')
  // at least 3 examples
  assert.ok(
    (readme.match(/\[\[series:/gi) || []).length >= 1,
    'series example present'
  )
  assert.ok(
    (readme.match(/\[\[character:/gi) || []).length >= 1,
    'character example present'
  )
  assert.ok(
    (readme.match(/\[\[product:/gi) || []).length >= 1,
    'product example present'
  )
  // slug normalization rules
  assert.match(
    readme,
    /slug\s+normalization/i,
    'explains slug normalization rules'
  )
  // states recommended default
  assert.match(
    readme,
    /recommended\s+default.*namespaced\s+links/i,
    'recommends namespaced links'
  )
})

test('B2: AGENTS.md instructs LLM policy for archive entities', () => {
  const agents = file(AGENTS)
  assert.match(
    agents,
    /must\s+use\s*\[\[<type>:<name>]]/i,
    'mandate namespaced links'
  )
  assert.match(
    agents,
    /prefer\s+dynamic\s+\/(archives)\//i,
    'prefer dynamic archive routes'
  )
  assert.match(
    agents,
    /emit\s+a\s+todo\s+on\s+ambiguity/i,
    'emit TODO on ambiguity'
  )
})
