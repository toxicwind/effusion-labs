import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const BUILD_DIR = process.env.ELEVENTY_BUILD_DIR || '/tmp/eleventy-build'

test('Canon Presence: best-of-luck builds at canonical route with rel=canonical', () => {
  const canon =
    '/archives/product/pop-mart-the-monsters-labubu-best-of-luck-plush/'
  const p = path.join(BUILD_DIR, canon, 'index.html')
  assert.ok(fs.existsSync(p), 'canonical product page exists')
  const html = fs.readFileSync(p, 'utf8')
  assert.match(html, new RegExp(`<link rel="canonical" href="${canon}">`))
})

test('Legacy Redirect: deep path and alias slug map to canonical in _redirects and stubs exist', () => {
  const redirectFile = path.join(BUILD_DIR, '_redirects')
  assert.ok(fs.existsSync(redirectFile), '_redirects exists')
  const redirects = fs.readFileSync(redirectFile, 'utf8')
  const deep =
    '/archives/collectables/designer-toys/pop-mart/the-monsters/products/pop-mart-the-monsters-labubu-best-of-luck-plush-std-20231230-reg-cn/'
  const alias =
    '/archives/product/pop-mart-the-monsters-labubu-best-of-luck-plush-std-20231230-reg-cn/'
  const target =
    '/archives/product/pop-mart-the-monsters-labubu-best-of-luck-plush/'
  assert.ok(
    redirects.includes(`${deep}  ${target}  308!`),
    'deep path redirect present'
  )
  assert.ok(
    redirects.includes(`${alias}  ${target}  308!`),
    'alias slug redirect present'
  )
  // Stubs
  const deepStub = path.join(BUILD_DIR, deep, 'index.html')
  const aliasStub = path.join(BUILD_DIR, alias, 'index.html')
  assert.ok(fs.existsSync(deepStub), 'deep stub page exists')
  assert.ok(fs.existsSync(aliasStub), 'alias stub page exists')
})

test('Link Hygiene: canonical product page contains no deep product hrefs', () => {
  const canon =
    '/archives/product/pop-mart-the-monsters-labubu-best-of-luck-plush/'
  const p = path.join(BUILD_DIR, canon, 'index.html')
  const html = fs.readFileSync(p, 'utf8')
  assert.equal(
    /\/archives\/collectables\/.+\/products\//.test(html),
    false,
    'no deep product hrefs in canonical page'
  )
})
