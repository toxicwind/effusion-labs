import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'

const spec = JSON.parse(fs.readFileSync('plan/src-normalize.spec.json', 'utf8'))

test('canonical role homes declared', () => {
  const r = spec.roles || {}
  ;[
    'routes',
    'content',
    'data',
    'includes',
    'scripts',
    'styles',
    'assets',
  ].forEach(k => assert.ok(Array.isArray(r[k])))
  assert.strictEqual(spec.allowOverlayAssets, true)
  assert.ok(spec.templatePattern.includes('11ty.js'))
})

test('archives dynamic templates treated as templates', () => {
  const pattern = spec.templatePattern
  assert.ok(pattern.includes('11ty.js'))
})

test('published CSS app.css exists', () => {
  assert.ok(fs.existsSync('src/assets/css/app.css'))
})
