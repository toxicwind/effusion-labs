import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8')
const workflow = readFileSync(
  new URL('../../.github/workflows/deploy.yml', import.meta.url),
  'utf8'
)

test('README documents npm test script', () => {
  assert.match(readme, /npm test/)
})

test('workflow references npm test', () => {
  assert.match(workflow, /npm test/)
})
