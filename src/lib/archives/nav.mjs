// src/lib/archives/nav.mjs
import fs from 'node:fs'
import path from 'node:path'
import { baseContentPath } from '../site.mjs'

function titleize(name) {
  return name
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

function subdirs(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter(e => e.isDirectory())
  } catch {
    return []
  }
}

function buildMap(dir, url, acc = {}) {
  const entries = subdirs(dir)
  acc[url] = entries.map(e => {
    const nextDir = path.join(dir, e.name)
    const childUrl = path.posix.join(url, e.name) + '/'
    const count = subdirs(nextDir).length
    return { title: titleize(e.name), url: childUrl, count }
  })
  for (const e of entries) {
    const nextDir = path.join(dir, e.name)
    const nextUrl = path.posix.join(url, e.name) + '/'
    buildMap(nextDir, nextUrl, acc)
  }
  return acc
}

export function buildArchiveNav() {
  const root = path.join(process.cwd(), baseContentPath, 'archives')
  return buildMap(root, '/archives/')
}

export default { buildArchiveNav }
