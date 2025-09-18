import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { buildLean } from '../helpers/eleventy-env.mjs'
import branding from '../../src/_data/branding.js'

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    const stats = statSync(p)
    if (stats.isDirectory()) walk(p, files)
    else files.push(p)
  }
  return files
}

test('homepage hero and work filters', async () => {
  const outDir = await buildLean('homepage')
  const htmlPath = path.join(outDir, 'index.html')
  const html = readFileSync(htmlPath, 'utf8')
  const dom = new JSDOM(html)
  const doc = dom.window.document

  // No invisible text utilities
  assert(!/text-transparent/.test(html))
  assert(!/opacity-0/.test(html))
  assert(!/text-base-content\/[0-8]\d/.test(html))

  // Hero
  const h1 = doc.querySelector('h1')
  assert.equal(h1.textContent.trim(), 'Experimental R&D you can actually use.')
  assert.match(html, /Prototypes, systems, and notes from the lab\./)
  const ctaLatest = Array.from(doc.querySelectorAll('a')).find(
    a => a.textContent.trim() === 'See the latest drop'
  )
  assert(ctaLatest)
  assert.equal(ctaLatest.getAttribute('href'), '/work/latest')
  const ctaExplore = Array.from(doc.querySelectorAll('a')).find(
    a => a.textContent.trim() === 'Explore the lab'
  )
  assert(ctaExplore)
  assert.equal(ctaExplore.getAttribute('href'), '/work')
  const bento = doc.querySelector('.bento')
  assert(bento)
  assert.equal(bento.querySelectorAll('a').length, 3)
  assert(!/· unknown ·/.test(html))
  // Logo
  const logo = doc.querySelector('img.hero-logo')
  assert(logo)
  assert.equal(logo.getAttribute('src'), '/logo.png')
  assert(!logo.hasAttribute('width'))
  assert(!logo.hasAttribute('height'))
  assert.match(logo.getAttribute('class') || '', /w-28/)
  assert.equal(logo.getAttribute('sizes'), branding.logoSizes)
  assert.equal(logo.getAttribute('loading'), 'eager')
  assert.equal(logo.getAttribute('fetchpriority'), 'high')

  // Map CTA
  const mapHeading = Array.from(doc.querySelectorAll('h2')).find(h =>
    /Interactive Concept Map/i.test(h.textContent)
  )
  assert(mapHeading)
  const mapSection = mapHeading.closest('section')
  assert(mapSection)
  const mapLink = Array.from(mapSection.querySelectorAll('a')).find(a =>
    /Launch the Map/i.test(a.textContent)
  )
  assert(mapLink)
  assert.equal(mapLink.getAttribute('href'), '/map/')
  // Property: exactly one link within the map section
  assert.equal(
    Array.from(mapSection.querySelectorAll('a[href="/map/"]')).length,
    1
  )

  // Skip link
  const skip = doc.querySelector('a.skip-link')
  assert(skip)
  assert.equal(skip.getAttribute('href'), '#main')
  assert(doc.getElementById('main'))

  // Work section with filters
  const workHeader = Array.from(doc.querySelectorAll('main h2')).find(
    h => h.textContent.trim() === 'Work'
  )
  assert(workHeader)
  const filterButtons = Array.from(doc.querySelectorAll('[data-filter]'))
  assert.equal(filterButtons.length, 5)
  assert.deepStrictEqual(
    filterButtons.map(b => b.dataset.filter),
    ['all', 'project', 'concept', 'spark', 'meta']
  )
  const list = doc.querySelector('#work-list')
  assert(list)
  const items = Array.from(list.querySelectorAll('li'))
  assert(items.length <= 9 && items.length >= 6)
  // Property: each item tagged with a valid type and matching chip
  const valid = ['project', 'concept', 'spark', 'meta']
  items.forEach(li => {
    assert(valid.includes(li.dataset.type))
    const chip = li.querySelector('.chip')
    assert(chip)
    assert.equal(chip.textContent.trim().toLowerCase(), li.dataset.type)
  })

  // Acceptance: work list uses grid layout
  assert(list.className.includes('grid'))

  // Property: each item exposes published date
  items.forEach(li => {
    const time = li.querySelector('time')
    assert(time)
    assert(time.getAttribute('datetime'))
  })

  // Contract: card affords hover/focus lift
  items.forEach(li => {
    const card = li.querySelector('a.aesthetic-row')
    assert(card)
    const cls = card.getAttribute('class')
    assert(cls.includes('hover:-translate-y-1'))
    assert(cls.includes('focus:-translate-y-1'))
  })

  // Contract: Vite bundle ships the work filters script
  const manifestPath = path.join(outDir, '.vite', 'manifest.json')
  assert(existsSync(manifestPath))
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const workEntry = manifest['work/index.html']
  assert(workEntry)
  const bundlePath = path.join(outDir, workEntry.file)
  assert(existsSync(bundlePath))
  const bundleContent = readFileSync(bundlePath, 'utf8')
  assert.match(bundleContent, /data-filter/)

  // Lab seal flourish
  assert(doc.querySelector('.lab-seal'))

  // Open Questions absence
  assert(!/Open Questions/i.test(html))
  const paths = walk(outDir)
  paths.forEach(p => {
    assert(!p.includes('open-questions'))
    if (p.endsWith('.html')) {
      const c = readFileSync(p, 'utf8')
      assert(!/Open Questions/i.test(c))
    }
  })
})
