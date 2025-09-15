import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'

const files = [
  'plan/relocate.spec.json',
  'plan/rewrites.spec.json',
  'plan/build.spec.json',
  'plan/src-normalize.spec.json',
  'plan/make-plan.mjs',
]

for (const f of files) {
  test(`exists: ${f}`, () => {
    assert.ok(fs.existsSync(f))
  })
}

test('relocate spec has required intents', () => {
  const spec = JSON.parse(fs.readFileSync('plan/relocate.spec.json', 'utf8'))
  const intents = spec.intents || []
  const has = (from, to) => intents.some(i => i.from === from && i.to === to)
  assert.strictEqual(spec.dryRun, true)
  assert.ok(has('docs/**', 'src/content/docs/**'))
  assert.ok(has('docs/vendor/**', 'src/content/docs/vendor-docs/**'))
  assert.ok(has('docs/vendors/**', 'src/content/docs/vendor-docs/**'))
  assert.ok(has('flower_reports_showcase/**', 'src/content/docs/flower/**'))
})

test('rewrites spec covers required pairs and publicUrlChanges', () => {
  const spec = JSON.parse(fs.readFileSync('plan/rewrites.spec.json', 'utf8'))
  const pairs = spec.pairs.map(p => p.join('->'))
  ;[
    'docs/->src/content/docs/',
    'docs/vendor/->src/content/docs/vendor-docs/',
    'docs/vendors/->src/content/docs/vendor-docs/',
    'flower_reports_showcase/->src/content/docs/flower/',
  ].forEach(p => assert.ok(pairs.includes(p)))
  assert.deepStrictEqual(spec.publicUrlChanges, [])
})

test('build spec includes passthroughs and cleanup line', () => {
  const spec = JSON.parse(fs.readFileSync('plan/build.spec.json', 'utf8'))
  assert.ok(spec.passthrough.includes('src/content/docs/vendor-docs/**'))
  assert.ok(spec.passthrough.includes('src/content/docs/flower/normalized/**'))
  assert.ok(spec.passthrough.includes('src/content/docs/flower/reports/**'))
  assert.ok(spec.cleanup && spec.cleanup.file && spec.cleanup.line)
})

test('src-normalize spec encodes overlay allowance and template rule', () => {
  const spec = JSON.parse(
    fs.readFileSync('plan/src-normalize.spec.json', 'utf8')
  )
  assert.strictEqual(spec.allowOverlayAssets, true)
  assert.ok(spec.templatePattern && spec.templatePattern.includes('11ty.js'))
})
