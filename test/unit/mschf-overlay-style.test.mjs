// test/unit/mschf-overlay-style.test.mjs
import test from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'

test('collage style includes base, ephemera, and lab modules', async () => {
  const html = `<!doctype html><html><body data-mschf="on" data-mschf-intensity="test" data-mschf-style="collage"></body></html>`
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'http://localhost',
  })

  dom.window.matchMedia =
    dom.window.matchMedia ||
    (() => ({ matches: false, addListener() {}, removeListener() {} }))
  // Polyfill browser APIs jsdom lacks
  let rafCalls = 0
  dom.window.requestAnimationFrame =
    dom.window.requestAnimationFrame ||
    (cb => {
      if (rafCalls++) return 0
      setTimeout(() => cb(Date.now()), 0)
      return rafCalls
    })
  dom.window.cancelAnimationFrame =
    dom.window.cancelAnimationFrame || (id => {})
  dom.window.IntersectionObserver =
    dom.window.IntersectionObserver ||
    function () {
      return { observe() {}, unobserve() {}, disconnect() {} }
    }

  const scriptPath = path.resolve('src/assets/js/mschf-overlay.js')
  dom.window.eval(readFileSync(scriptPath, 'utf8'))
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'))
  // Allow boot + first RAF tick
  await new Promise(r => setTimeout(r, 50))
  const doc = dom.window.document

  // Scaffold always mounts
  assert.ok(doc.querySelector('.mschf-grid'))
  assert.ok(doc.querySelector('.mschf-frame'))
  // Ephemera (1..3) in collage
  assert.ok(
    doc.querySelector(
      '.mschf-tape, .mschf-stamp, .mschf-quotes, .mschf-plate, .mschf-specimen'
    )
  )
  // Lab elements: when GPU not available, DOM variants are used
  assert.ok(
    doc.querySelector(
      '.mschf-callout, .mschf-graph, .mschf-rings, .mschf-topo, .mschf-halftone, .mschf-perf, .mschf-stars'
    )
  )
})

test('auto style mounts overlay in auto mode', async () => {
  const html = `<!doctype html><html><body data-mschf="on" data-mschf-intensity="test" data-mschf-style="auto"></body></html>`
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'http://localhost/?mschf-seed=1',
  })
  dom.window.matchMedia =
    dom.window.matchMedia ||
    (() => ({ matches: false, addListener() {}, removeListener() {} }))
  let rafCalls2 = 0
  dom.window.requestAnimationFrame =
    dom.window.requestAnimationFrame ||
    (cb => {
      if (rafCalls2++) return 0
      setTimeout(() => cb(Date.now()), 0)
      return rafCalls2
    })
  dom.window.cancelAnimationFrame =
    dom.window.cancelAnimationFrame || (id => {})
  dom.window.IntersectionObserver =
    dom.window.IntersectionObserver ||
    function () {
      return { observe() {}, unobserve() {}, disconnect() {} }
    }
  const scriptPath = path.resolve('src/assets/js/mschf-overlay.js')
  dom.window.eval(readFileSync(scriptPath, 'utf8'))
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'))
  await new Promise(r => setTimeout(r, 50))
  const doc = dom.window.document
  const root = doc.getElementById('mschf-overlay-root')
  assert.ok(root, 'overlay root should exist')
  assert.ok(doc.querySelector('.mschf-grid'))
  assert.ok(
    doc.querySelector(
      '.mschf-tape, .mschf-stamp, .mschf-quotes, .mschf-plate, .mschf-specimen, .mschf-callout, .mschf-graph, .mschf-rings, .mschf-topo, .mschf-halftone, .mschf-perf, .mschf-stars'
    )
  )
})
