import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { finished } from 'node:stream/promises'

import tar from 'tar'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const DATASET_ROOT = path.join(projectRoot, 'src/content/projects/lv-images')
const GENERATED_DIR = path.join(DATASET_ROOT, 'generated')
const BUNDLE_PATH = path.join(GENERATED_DIR, 'lv.bundle.tgz')
const CACHE_DIR = path.join(projectRoot, '.cache', 'lv-images')
const INDEX_PATH = path.join(CACHE_DIR, 'index.json')
const META_PATH = path.join(CACHE_DIR, 'meta.json')
const METRICS_PATH = path.join(CACHE_DIR, 'ingest-metrics.json')

const BANNED_HOSTS = new Set(['www.olyv.co.in', 'app.urlgeni.us'])

const pointerSignature = Buffer.from('version https://git-lfs.github.com/spec/v1')

function isLikelyPointer(buffer) {
  if (!buffer || buffer.length < pointerSignature.length) return false
  return buffer.slice(0, pointerSignature.length).equals(pointerSignature)
}

async function runGitLfsPull({ logger } = {}) {
  const { spawn } = await import('node:child_process')
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['lfs', 'pull', `--include="src/content/projects/lv-images/generated/lv.bundle.tgz"`], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    proc.stdout.on('data', (chunk) => {
      if (logger) logger(chunk.toString().trim())
    })
    proc.stderr.on('data', (chunk) => {
      if (logger) logger(chunk.toString().trim())
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve(true)
      else reject(new Error(`git lfs pull failed with code ${code}`))
    })
  })
}

export async function ensureBundleAvailable({ logger } = {}) {
  let buffer
  try {
    buffer = await readFile(BUNDLE_PATH)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      if (logger) logger('[lv-images] bundle missing — attempting git lfs pull')
      await runGitLfsPull({ logger })
      buffer = await readFile(BUNDLE_PATH)
    } else {
      throw error
    }
  }

  if (isLikelyPointer(buffer)) {
    if (logger) logger('[lv-images] bundle is LFS pointer — syncing real artifact')
    await runGitLfsPull({ logger })
    buffer = await readFile(BUNDLE_PATH)
    if (isLikelyPointer(buffer)) {
      throw new Error('lv.bundle.tgz still resolves to LFS pointer after git lfs pull')
    }
  }
  return { path: BUNDLE_PATH, size: buffer.length }
}

async function collectEntry(entry) {
  const chunks = []
  entry.on('data', (chunk) => chunks.push(chunk))
  entry.resume()
  await finished(entry)
  return Buffer.concat(chunks)
}

function normalizeRobotEntry(host, payload) {
  if (!payload || typeof payload !== 'object') return null
  const groups = Array.isArray(payload.groups) ? payload.groups : []
  const allow = []
  const disallow = []
  const sitemaps = []
  const userAgents = new Set()
  for (const group of groups) {
    const agents = Array.isArray(group.agents) ? group.agents : []
    for (const agent of agents) userAgents.add(agent)
    const rules = Array.isArray(group.rules) ? group.rules : []
    for (const rule of rules) {
      if (!rule) continue
      if (rule.type === 'allow') allow.push(rule.path)
      if (rule.type === 'disallow') disallow.push(rule.path)
      if (rule.type === 'sitemap') sitemaps.push(rule.path)
    }
  }
  return {
    host,
    agents: Array.from(userAgents),
    allow,
    disallow,
    sitemaps,
    issue: payload.issue ?? false,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    fetchedAt: payload.fetchedAt || null,
    status: payload.http?.status ?? null,
    contentType: payload.http?.contentType || '',
    path: payload.path || '',
  }
}

function normalizeDocEntry(relPath, payload) {
  const host = relPath.split('/')[0] || 'unknown'
  const status = payload?.http?.status ?? null
  const size = payload?.size ?? 0
  return {
    host,
    path: relPath,
    url: payload?.url || '',
    status,
    contentType: payload?.http?.contentType || '',
    size,
    sizeLabel: size ? formatBytes(size) : '',
    cachedAt: payload?.fetchedAt || null,
    issue: Boolean(payload?.issue),
  }
}

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let idx = 0
  let value = bytes
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx++
  }
  return `${value % 1 ? value.toFixed(1) : value} ${units[idx]}`
}

function extractHostname(candidate) {
  if (!candidate) return ''
  if (typeof candidate === 'string') {
    try {
      const url = new URL(candidate)
      return (url.hostname || '').toLowerCase()
    } catch (error) {
      return candidate.toLowerCase()
    }
  }
  if (candidate && typeof candidate === 'object') {
    const value = candidate.host || candidate.hostname || candidate.url || candidate.pageUrl || ''
    return extractHostname(value)
  }
  return ''
}

function isBannedHost(candidate) {
  const host = extractHostname(candidate)
  return host ? BANNED_HOSTS.has(host) : false
}

function isBannedUrl(url) {
  const host = extractHostname(url)
  return host ? BANNED_HOSTS.has(host) : false
}

function toIndexRow(meta) {
  if (!meta || typeof meta !== 'object') return null
  const locale = meta.locale || meta.market || ''
  const productType = meta.productType || meta.type || ''
  const updatedAt = meta.lastSeen || meta.lastUpdated || meta.lastMod || ''
  const createdAt = meta.firstSeen || meta.createdAt || ''
  const tags = Array.isArray(meta.tags) ? meta.tags : []
  return {
    id: meta.id || meta.hash || '',
    sku: meta.sku || meta.slug || '',
    title: meta.title || meta.name || '',
    locale,
    productType,
    pageUrl: meta.pageUrl || meta.url || '',
    imageUrl: meta.src || meta.heroImage || '',
    hasHero: Boolean(meta.heroImage || meta.hero || meta.primaryImage),
    imageCount: typeof meta.imageCount === 'number' ? meta.imageCount : (meta.images?.length || 0),
    duplicateOf: meta.duplicateOf || null,
    updatedAt,
    createdAt,
    tags,
    lastMod: meta.lastMod || '',
    variantCount: typeof meta.variantCount === 'number' ? meta.variantCount : null,
  }
}

function enrichIndexRows(itemsMeta = {}) {
  const rows = []
  for (const [id, meta] of Object.entries(itemsMeta)) {
    if (!meta) continue
    const row = toIndexRow({ ...meta, id })
    if (!row) continue
    if (isBannedUrl(row.pageUrl) || isBannedUrl(row.imageUrl)) continue
    rows.push(row)
  }
  return rows
}

function sanitizeSummary(summary = {}) {
  const next = { ...summary }
  if (Array.isArray(summary.hosts)) {
    next.hosts = summary.hosts.filter((entry) => !isBannedHost(entry?.host || entry?.id || entry))
  }
  if (Array.isArray(summary.sitemaps)) {
    next.sitemaps = summary.sitemaps.filter((entry) => !isBannedUrl(entry?.url || entry?.loc || entry))
  }
  if (Array.isArray(summary.issues)) {
    next.issues = summary.issues.filter((entry) => !isBannedHost(entry?.host || entry))
  }
  return next
}

function computeFacets(rows) {
  const locales = new Map()
  const productTypes = new Map()
  const updatedMonths = new Map()
  let heroCount = 0
  for (const row of rows) {
    if (!row) continue
    const localeKey = row.locale || 'unknown'
    locales.set(localeKey, (locales.get(localeKey) || 0) + 1)
    const typeKey = row.productType || 'other'
    productTypes.set(typeKey, (productTypes.get(typeKey) || 0) + 1)
    if (row.hasHero) heroCount++
    if (row.updatedAt) {
      const month = row.updatedAt.slice(0, 7)
      if (month) updatedMonths.set(month, (updatedMonths.get(month) || 0) + 1)
    }
  }
  return {
    locales: Array.from(locales.entries()).map(([value, count]) => ({ value, count })),
    productTypes: Array.from(productTypes.entries()).map(([value, count]) => ({ value, count })),
    updatedMonths: Array.from(updatedMonths.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, count]) => ({ value, count })),
    heroCount,
  }
}

export async function buildIndex({ logger } = {}) {
  await ensureBundleAvailable({ logger })
  await mkdir(CACHE_DIR, { recursive: true })

  const metrics = {
    startedAt: new Date().toISOString(),
    bundleBytes: 0,
    parseMs: 0,
    entryCount: 0,
    robotCount: 0,
    docCount: 0,
  }
  const start = performance.now()

  const rawRows = []
  const robots = []
  const docs = []
  let summary = null
  let runsHistory = []
  let products = []
  let allImages = []

  const entryPromises = []
  await tar.t({
    file: BUNDLE_PATH,
    onentry: (entry) => {
      if (!entry.path.startsWith('lv/')) {
        entry.resume()
        return
      }
      const relPath = entry.path.slice(3)
      const task = collectEntry(entry).then((buffer) => {
        if (relPath === 'summary.json') {
          summary = JSON.parse(buffer.toString('utf8') || '{}')
          return
        }
        if (relPath === 'runs-history.json') {
          runsHistory = JSON.parse(buffer.toString('utf8') || '[]')
          return
        }
        if (relPath === 'all-products.json') {
          products = JSON.parse(buffer.toString('utf8') || '[]')
          return
        }
        if (relPath === 'all-images.json') {
          allImages = JSON.parse(buffer.toString('utf8') || '[]')
          return
        }
        if (relPath === 'items-meta.json') {
          const meta = JSON.parse(buffer.toString('utf8') || '{}')
          rawRows.push(...enrichIndexRows(meta))
          metrics.entryCount = rawRows.length
          return
        }
        if (relPath.startsWith('cache/robots/') && relPath.endsWith('.json')) {
          try {
            const payload = JSON.parse(buffer.toString('utf8') || '{}')
            const host = path.basename(relPath, '.json')
            const normalized = normalizeRobotEntry(host, payload)
            if (normalized) {
              if (!isBannedHost(host)) {
                robots.push(normalized)
                metrics.robotCount = robots.length
              }
            }
          } catch (error) {
            if (logger) logger(`[lv-images] failed to parse robots entry ${relPath}: ${error?.message || error}`)
          }
          return
        }
        if (relPath.startsWith('cache/sitemaps/') && relPath.endsWith('.json')) {
          try {
            const payload = JSON.parse(buffer.toString('utf8') || '{}')
            const normalized = normalizeDocEntry(relPath.replace('cache/sitemaps/', ''), payload)
            if (!isBannedHost(normalized.host)) {
              docs.push(normalized)
              metrics.docCount = docs.length
            }
          } catch (error) {
            if (logger) logger(`[lv-images] failed to parse cached doc ${relPath}: ${error?.message || error}`)
          }
          return
        }
      })
      entryPromises.push(task)
    },
  })
  await Promise.all(entryPromises)

  metrics.parseMs = Math.round(performance.now() - start)
  const bundleStats = await stat(BUNDLE_PATH)
  metrics.bundleBytes = bundleStats.size

  const rows = rawRows.filter((row) => !isBannedUrl(row.pageUrl) && !isBannedUrl(row.imageUrl))
  metrics.entryCount = rows.length
  const filteredProducts = Array.isArray(products)
    ? products.filter((product) => !isBannedUrl(product?.pageUrl || product?.url || product?.href))
    : []
  const filteredImages = Array.isArray(allImages)
    ? allImages.filter((image) => !isBannedUrl(image?.pageUrl || image?.url || image?.src))
    : []
  const facets = computeFacets(rows)
  const totals = {
    items: rows.length,
    locales: facets.locales.length,
    productTypes: facets.productTypes.length,
    heroItems: facets.heroCount,
    documents: docs.length,
    robots: robots.length,
    products: filteredProducts.length,
    images: filteredImages.length,
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    bundle: {
      size: metrics.bundleBytes,
      sha256: await hashFile(BUNDLE_PATH),
    },
    summary: sanitizeSummary(summary) || {},
    totals,
    runsHistory,
    robots,
    docs,
    products: filteredProducts,
    images: filteredImages.slice(0, 1000),
    facets,
    metrics,
  }

  const indexPayload = {
    meta,
    rows,
  }

  await writeFile(INDEX_PATH, `${JSON.stringify(indexPayload)}\n`)
  await writeFile(META_PATH, `${JSON.stringify(meta)}\n`)
  await writeFile(METRICS_PATH, `${JSON.stringify(metrics)}\n`)

  return { indexPath: INDEX_PATH, metaPath: META_PATH, metricsPath: METRICS_PATH, meta, rows }
}

async function hashFile(filePath) {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)
  return new Promise((resolve, reject) => {
    stream.on('error', reject)
    hash.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => {
      try {
        resolve(hash.digest('hex'))
      } catch (error) {
        reject(error)
      }
    })
  })
}

export async function cleanIndexCache() {
  await rm(CACHE_DIR, { recursive: true, force: true })
}

export const paths = {
  bundle: BUNDLE_PATH,
  cache: CACHE_DIR,
  index: INDEX_PATH,
  meta: META_PATH,
  metrics: METRICS_PATH,
}
