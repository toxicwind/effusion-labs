import fs from 'node:fs'
import path from 'node:path'
import { baseContentPath } from '../../config/site.js'

/**
 * Convert a directory name to a human-friendly title.
 * @param {string} name
 * @returns {string}
 */
function titleize(name) {
  return name
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

function subdirs(p) {
  return fs.readdirSync(p, { withFileTypes: true }).filter(e => e.isDirectory())
}

/**
 * Build a map of archive navigation entries keyed by their URL.
 * @param {string} dir absolute directory to scan
 * @param {string} url base url for the directory
 * @param {Object} acc accumulator for recursive results
 * @returns {Object} map of url -> nav items
 */
function buildMap(dir, url, acc = {}) {
  const entries = subdirs(dir)

  acc[url] = entries.map(e => {
    const nextDir = path.join(dir, e.name)
    const childUrl = path.posix.join(url, e.name) + '/'
    const count = subdirs(nextDir).length
    return { title: titleize(e.name), url: childUrl, count }
  })

  entries.forEach(e => {
    const nextDir = path.join(dir, e.name)
    const nextUrl = path.posix.join(url, e.name) + '/'
    buildMap(nextDir, nextUrl, acc)
  })

  return acc
}

/**
 * Build navigation map for archives based on folder structure.
 * @returns {Object}
 */
export function buildArchiveNav() {
  const root = path.join(process.cwd(), baseContentPath, 'archives')
  return buildMap(root, '/archives/')
}

export default { buildArchiveNav }
