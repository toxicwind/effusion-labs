import MarkdownIt from 'markdown-it'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import links from '../../config/markdown/links.js'
const { externalLinks } = links

// Acceptance example: any external link gains arrow prefix and class
await test('external link renders with arrow and class', () => {
  const md = new MarkdownIt()
  md.use(externalLinks)
  const html = md.render('[Example](https://example.com)')
  assert.match(html, /class="external-link"/)
  assert.ok(html.includes('>↗ Example<'))
})

// Property: internal links remain unchanged and lack external class
await test('internal link keeps text without external markers', () => {
  const md = new MarkdownIt()
  md.use(externalLinks)
  const html = md.render('[Example](/about)')
  assert.ok(html.includes('>Example<'))
  assert.ok(!html.includes('external-link'))
})

// Contract: arrow not duplicated when already present
await test('external link starting with arrow does not duplicate', () => {
  const md = new MarkdownIt()
  md.use(externalLinks)
  const html = md.render('[↗ Example](https://example.com)')
  const arrows = html.match(/↗/g) || []
  assert.equal(arrows.length, 1)
})
