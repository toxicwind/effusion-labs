// src/_data/lvreport.js — prefers decoded robots JSON, falls back to text parser

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MiniSearch from 'minisearch'

import {
  buildDocsArray,
  collectRobotsEntries,
  normalizeUrlmetaMap,
  readBundleDataset,
} from '../lib/lv/bundle-reader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LV_BASE = path.resolve(__dirname, '../content/projects/lv-images/generated/lv')
const DATASET_ROOT_HREF = '/content/projects/lv-images/'
export const DATASET_REPORT_FILE = path.join(LV_BASE, 'lvreport.dataset.json')

const BANNED_HOSTS = new Set(['www.olyv.co.in', 'app.urlgeni.us'])

const MINI_SEARCH_OPTIONS = {
  fields: ['title', 'description', 'tags'],
  storeFields: ['id', 'title', 'description', 'href', 'section', 'badge', 'tags', 'meta'],
  searchOptions: {
    boost: { title: 2, tags: 1.5 },
    prefix: true,
    fuzzy: 0.2,
  },
}

function toDatasetHref(relPath) {
  if (!relPath) return ''
  const normalized = String(relPath).trim().replace(/^\.\/?/, '').replace(/^\/+/, '')
  if (!normalized) return ''
  return `${DATASET_ROOT_HREF}${normalized}`
}

// Fallback minimal parser for robots.txt (used only if no decoded JSON exists)
function parseRobots(text) {
  const groups = []
  const other = {}
  let cur = null
  let ruleCount = 0

  const lines = (text || '').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Za-z][A-Za-z-]*)\s*:\s*(.+)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()

    if (key === 'user-agent') {
      cur = { agents: new Set([val.toLowerCase()]), rules: [] }
      groups.push(cur)
      continue
    }
    if (!cur) {
      cur = { agents: new Set(['*']), rules: [] }
      groups.push(cur)
    }

    if (['allow', 'disallow', 'noindex', 'crawl-delay', 'sitemap'].includes(key)) {
      cur.rules.push({ type: key, path: val })
      ruleCount++
    } else {
      const nk = key.replace(/[^\da-z]+/gi, '_')
      ;(other[nk] ||= []).push(val)
    }
  }

  const merged = { allow: [], disallow: [], noindex: [], crawlDelay: null, sitemaps: [] }
  for (const g of groups) {
    for (const r of g.rules) {
      if (r.type === 'allow') merged.allow.push(r.path)
      if (r.type === 'disallow') merged.disallow.push(r.path)
      if (r.type === 'noindex') merged.noindex.push(r.path)
      if (r.type === 'crawl-delay') {
        const n = Number(r.path)
        if (!Number.isNaN(n)) {
          merged.crawlDelay = merged.crawlDelay == null
            ? n
            : Math.min(merged.crawlDelay, n)
        }
      }
      if (r.type === 'sitemap') merged.sitemaps.push(r.path)
    }
  }
  return { groups, merged, other, hasRules: ruleCount > 0 }
}

function classifySitemap(url) {
  const u = String(url).toLowerCase()
  if (u.includes('sitemap-image')) return 'image'
  if (u.includes('sitemap-product')) return 'product'
  if (u.includes('sitemap-content')) return 'content'
  if (u.includes('sitemap-catalog')) return 'catalog'
  if (u.endsWith('/sitemap.xml') || /\/sitemap[^/]*\.xml(\.gz)?$/.test(u)) return 'index'
  return 'other'
}

function normalizeHost(value) {
  if (value == null) return ''
  const text = cleanText(value).toLowerCase()
  if (!text) return ''
  try {
    const url = text.includes('://') ? new URL(text) : new URL(`https://${text}`)
    return url.host.toLowerCase()
  } catch {
    const stripped = text.replace(/^https?:\/\//, '').split('/')[0]
    return stripped.toLowerCase()
  }
}

function stripWww(host) {
  if (!host) return ''
  return host.startsWith('www.') ? host.slice(4) : host
}

function isBannedHost(value) {
  const host = normalizeHost(value)
  if (!host) return false
  if (BANNED_HOSTS.has(host)) return true
  const bare = stripWww(host)
  return BANNED_HOSTS.has(bare) || BANNED_HOSTS.has(`www.${bare}`)
}

function hostFromCandidates(...values) {
  for (const value of values) {
    const host = normalizeHost(value)
    if (host) return host
  }
  return ''
}

const STATUS_NAME = {
  301: 'Moved Permanently',
  302: 'Found',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  410: 'Gone',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

const ROBOTS_CATEGORY_META = {
  ok: { label: 'Valid robots.txt', tone: 'ok', issue: false },
  'html-error': { label: 'HTML error page', tone: 'error', issue: true },
  'json-error': { label: 'JSON error', tone: 'error', issue: true },
  json: { label: 'JSON payload', tone: 'info', issue: false },
  text: { label: 'Plain text (no directives)', tone: 'warn', issue: true },
  empty: { label: 'Empty response', tone: 'error', issue: true },
  'no-cache': { label: 'No cached copy', tone: 'warn', issue: true },
}

const DOC_CATEGORY_META = {
  xml: { label: 'XML document', tone: 'ok', issue: false },
  'html-error': { label: 'HTML error page', tone: 'error', issue: true },
  'json-error': { label: 'JSON error', tone: 'error', issue: true },
  json: { label: 'JSON payload', tone: 'info', issue: false },
  'robots-txt': { label: 'Robots/text directives', tone: 'info', issue: false },
  text: { label: 'Plain text', tone: 'info', issue: false },
  gzip: { label: 'Compressed (.gz)', tone: 'warn', issue: true },
  empty: { label: 'Empty response', tone: 'error', issue: true },
  unknown: { label: 'Unclassified', tone: 'warn', issue: true },
}

function normalizeReason(reason) {
  if (!reason) return ''
  return reason.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
function formatHttpStatus(code, reason) {
  const normalized = normalizeReason(reason)
  if (code && normalized) return `${code} ${normalized}`.trim()
  if (code) return `${code} ${STATUS_NAME[code] || ''}`.trim()
  return normalized
}
function classifyRobotsResponse(rawText, hasCached) {
  if (!hasCached) {
    const meta = ROBOTS_CATEGORY_META['no-cache']
    return {
      category: 'no-cache',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: null,
      httpLabel: '',
    }
  }

  const trimmed = (rawText || '').trim()
  if (!trimmed) {
    const meta = ROBOTS_CATEGORY_META.empty
    return {
      category: 'empty',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: null,
      httpLabel: '',
    }
  }

  if (/<!doctype html|<html/i.test(trimmed.substring(0, 200))) {
    const status = extractHttpStatus(trimmed)
    const meta = ROBOTS_CATEGORY_META['html-error']
    return {
      category: 'html-error',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: status?.code ?? null,
      httpLabel: status ? formatHttpStatus(status.code, status.reason) || meta.label : meta.label,
    }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const status = extractHttpStatus(trimmed)
    const isError = typeof status?.code === 'number' && status.code >= 400
    const category = isError ? 'json-error' : 'json'
    const meta = ROBOTS_CATEGORY_META[category] || ROBOTS_CATEGORY_META.json
    return {
      category,
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue || isError,
      httpStatus: status?.code ?? null,
      httpLabel: status ? formatHttpStatus(status.code, status.reason) || meta.label : meta.label,
    }
  }

  if (!/user-agent/i.test(trimmed)) {
    const meta = ROBOTS_CATEGORY_META.text
    return {
      category: 'text',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: null,
      httpLabel: '',
    }
  }

  const meta = ROBOTS_CATEGORY_META.ok
  return {
    category: 'ok',
    label: meta.label,
    tone: meta.tone,
    isIssue: meta.issue,
    httpStatus: null,
    httpLabel: '',
  }
}
function extractHttpStatus(text) {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const obj = JSON.parse(trimmed)
      if (typeof obj?.statusCode === 'number') {
        const code = obj.statusCode
        const reason = obj.error || obj.message || STATUS_NAME[code] || ''
        return { code, reason: normalizeReason(reason) }
      }
    } catch {}
  }
  const titleMatch = trimmed.match(/<title>\s*(\d{3})\s*([^<]*)/i)
  if (titleMatch) return { code: Number(titleMatch[1]), reason: normalizeReason(titleMatch[2]) }
  const h1Match = trimmed.match(/<h1>\s*(\d{3})\s*([^<]*)/i)
  if (h1Match) return { code: Number(h1Match[1]), reason: normalizeReason(h1Match[2]) }

  const statusCodeMatch = trimmed.match(/\b(301|302|307|308|400|401|403|404|410|429|500|503)\b/)
  let code = statusCodeMatch ? Number(statusCodeMatch[1]) : null

  let reason = null
  if (/forbidden/i.test(trimmed)) reason = 'Forbidden'
  else if (/unauthorized/i.test(trimmed)) reason = 'Unauthorized'
  else if (/not found/i.test(trimmed) || /cannot get/i.test(trimmed)) reason = 'Not Found'
  else if (/too many requests/i.test(trimmed)) reason = 'Too Many Requests'
  else if (/service unavailable|unavailable/i.test(trimmed)) reason = 'Service Unavailable'
  else if (/access denied/i.test(trimmed)) reason = 'Access Denied'
  else if (/bad request/i.test(trimmed)) reason = 'Bad Request'

  if (!code && reason) {
    const map = {
      Forbidden: 403,
      Unauthorized: 401,
      'Not Found': 404,
      'Too Many Requests': 429,
      'Service Unavailable': 503,
      'Access Denied': 403,
      'Bad Request': 400,
    }
    code = map[reason] || null
  }
  if (code) return { code, reason: reason || STATUS_NAME[code] || '' }
  if (reason) return { code: null, reason }
  return null
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx++
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(decimals)} ${units[idx]}`
}

function enrichArchive(meta) {
  if (!meta || typeof meta !== 'object') return null
  return deepClean({
    ...meta,
    sizeLabel: typeof meta.size === 'number' ? formatBytes(meta.size) : null,
    shaPreview: meta.sha256 ? String(meta.sha256).slice(0, 16) : null,
    href: meta.path ? toDatasetHref(meta.path) : '',
  })
}

function enrichDatasetMeta(meta) {
  if (!meta || typeof meta !== 'object') return null
  return deepClean({
    ...meta,
    sizeLabel: typeof meta.totalBytes === 'number' ? formatBytes(meta.totalBytes) : null,
  })
}

function enrichHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  return deepClean({
    ...entry,
    sizeLabel: typeof entry.size === 'number' ? formatBytes(entry.size) : null,
    href: entry.path ? toDatasetHref(entry.path) : '',
    legacyHref: entry.legacyPath ? toDatasetHref(entry.legacyPath) : '',
    shaPreview: entry.sha256 ? String(entry.sha256).slice(0, 16) : null,
  })
}

function enrichHistory(history) {
  if (!history || typeof history !== 'object') return null
  const entries = Array.isArray(history.entries)
    ? history.entries.map((entry) => enrichHistoryEntry(entry)).filter(Boolean)
    : []
  const latest = history.latest ? enrichHistoryEntry(history.latest) : entries[0] || null
  return deepClean({
    ...history,
    entries,
    latest,
    manifestHref: history.manifestPath ? toDatasetHref(history.manifestPath) : '',
    directoryHref: history.directory ? toDatasetHref(history.directory) : '',
  })
}

function enrichManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return null
  return deepClean({
    ...manifest,
    archive: enrichArchive(manifest.archive || null),
    dataset: enrichDatasetMeta(manifest.dataset || null),
    history: enrichHistory(manifest.history || null),
    summary: manifest.summary ? deepClean(manifest.summary) : null,
  })
}

function buildFlagSections(bans) {
  if (!bans || typeof bans !== 'object') return []
  const listConfigs = [
    {
      key: 'candidates',
      title: 'Primary ban candidates',
      description: 'Hosts flagged for exclusion in this crawl.',
      tone: 'warn',
    },
    {
      key: 'zeroContentSitemaps',
      title: 'Zero-content sitemaps',
      description: 'Sitemaps that returned no URLs or empty payloads.',
      tone: 'warn',
    },
    {
      key: 'skippedDueToErrors',
      title: 'Skipped hosts — fetch errors',
      description: 'Endpoints skipped after repeated failures during sitemap or robots fetches.',
      tone: 'error',
    },
    {
      key: 'preservedDueToHistory',
      title: 'Preserved for historical coverage',
      description: 'Hosts retained because previous snapshots still reference them.',
      tone: 'info',
    },
    {
      key: 'massRemovalSafeguardHosts',
      title: 'Safeguarded removals',
      description: 'Hosts protected by mass-removal safeguards.',
      tone: 'warn',
    },
    {
      key: 'skippedDueToUnknownHistory',
      title: 'Skipped — unknown history',
      description: 'Hosts deferred because historical context was unavailable.',
      tone: 'info',
    },
  ]
  const MAX_ITEMS = 60
  const sections = []
  for (const config of listConfigs) {
    const items = Array.isArray(bans[config.key])
      ? bans[config.key].map((item) => cleanText(item)).filter(Boolean)
      : []
    if (!items.length) continue
    const trimmed = items.slice(0, MAX_ITEMS)
    const overflow = Math.max(0, items.length - trimmed.length)
    sections.push({
      key: config.key,
      title: config.title,
      description: config.description,
      tone: config.tone,
      count: items.length,
      items: trimmed,
      overflow,
    })
  }
  if (bans.massRemovalSafeguardTriggered) {
    sections.push({
      key: 'massRemovalSafeguardTriggered',
      title: 'Mass-removal safeguard triggered',
      description: 'Bulk deletions were blocked to avoid regressions — review before purging.',
      tone: 'warn',
      count: 1,
      items: [],
    })
  }
  if (bans.skippedRewrite) {
    sections.push({
      key: 'skippedRewrite',
      title: 'Rewrite phase skipped',
      description: 'Rewrite operations were deferred; rebuilt URLs may require manual review.',
      tone: 'info',
      count: 1,
      items: [],
    })
  }
  return sections
}

function truncatePreview(text, max = 320) {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trim()}…`
}

function cleanText(value) {
  if (value == null) return ''
  let text = String(value).replace(/\s+/g, ' ').trim()
  if (
    (text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim()
  }
  if (text.startsWith('"') && text.includes('://')) {
    text = text.replace(/^"+/, '')
  }
  if (text.endsWith('"') && text.includes('://')) {
    text = text.replace(/"+$/, '')
  }
  return text
}

function deepClean(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => deepClean(entry))
      .filter((entry) => entry !== undefined && entry !== null && entry !== '')
  }
  if (value && typeof value === 'object') {
    const next = {}
    for (const [key, entry] of Object.entries(value)) {
      const cleaned = deepClean(entry)
      if (cleaned === undefined || cleaned === null) continue
      if (typeof cleaned === 'string' && cleaned.length === 0) continue
      next[key] = cleaned
    }
    return next
  }
  if (typeof value === 'string') return cleanText(value)
  return value
}

function pushSearchDoc(list, doc) {
  if (!list) return
  if (!doc || !doc.id) return
  list.push({
    id: doc.id,
    section: doc.section || 'general',
    title: cleanText(doc.title || ''),
    description: cleanText(doc.description || ''),
    href: doc.href || '',
    badge: doc.badge || '',
    tags: Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [],
    meta: doc.meta ? deepClean(doc.meta) : {},
  })
}

function upsertImage(map, entry) {
  const id = cleanText(entry?.id || '')
  if (!id) return null
  const existing = map.get(id) || {
    id,
    src: '',
    basename: '',
    pageUrl: '',
    title: '',
    host: '',
    firstSeen: '',
    lastSeen: '',
    duplicateOf: null,
  }

  const updated = {
    ...existing,
    src: entry?.src ? cleanText(entry.src) : existing.src,
    basename: entry?.basename ? cleanText(entry.basename) : existing.basename,
    pageUrl: entry?.pageUrl ? cleanText(entry.pageUrl) : existing.pageUrl,
    title: entry?.title ? cleanText(entry.title) : existing.title,
    host: entry?.host ? cleanText(entry.host) : existing.host,
    firstSeen: entry?.firstSeen && (!existing.firstSeen || entry.firstSeen < existing.firstSeen)
      ? entry.firstSeen
      : existing.firstSeen,
    lastSeen: entry?.lastSeen && (!existing.lastSeen || entry.lastSeen > existing.lastSeen)
      ? entry.lastSeen
      : existing.lastSeen,
    duplicateOf: entry?.duplicateOf ?? existing.duplicateOf ?? null,
  }

  if (!updated.basename && updated.src) {
    const withoutQuery = updated.src.split(/[#?]/)[0] || updated.src
    updated.basename = cleanText(path.basename(withoutQuery))
  }

  const host = hostFromCandidates(updated.host, updated.pageUrl, updated.src)
  if (host && isBannedHost(host)) {
    map.delete(id)
    return null
  }

  map.set(id, updated)
  return updated
}

function upsertProduct(map, pageUrl) {
  const key = cleanText(pageUrl) || `__product-${map.size + 1}`
  if (!map.has(key)) {
    map.set(key, {
      pageUrl: cleanText(pageUrl || ''),
      title: '',
      images: [],
      firstSeen: '',
      lastSeen: '',
      cache: null,
      urls: null,
    })
  }
  return map.get(key)
}

function mergeProducts(product, image, meta) {
  if (!product || !image) return
  if (!product.images.some((item) => item.id === image.id)) {
    product.images.push({ id: image.id, src: image.src, duplicateOf: image.duplicateOf })
  }
  if (!product.title && image.title) product.title = image.title
  if (!product.pageUrl && image.pageUrl) product.pageUrl = image.pageUrl
  if (meta?.firstSeen && (!product.firstSeen || meta.firstSeen < product.firstSeen)) {
    product.firstSeen = meta.firstSeen
  }
  if (meta?.lastSeen && (!product.lastSeen || meta.lastSeen > product.lastSeen)) {
    product.lastSeen = meta.lastSeen
  }
}

function buildAggregates({ itemsMeta, legacyImages, legacyProducts, summaryItems = {} }) {
  const imageMap = new Map()
  const productMap = new Map()
  const summaryItemsSafe = summaryItems && typeof summaryItems === 'object' ? summaryItems : {}

  const addFromMeta = (metaEntries) => {
    if (!metaEntries) return
    for (const [id, meta] of Object.entries(metaEntries)) {
      if (!meta || meta.removedAt) continue
      if (isBannedHost(hostFromCandidates(meta.host, meta.pageUrl))) continue
      const image = upsertImage(imageMap, { ...meta, id })
      if (!image) continue
      const product = upsertProduct(productMap, meta.pageUrl || '')
      mergeProducts(product, image, meta)
    }
  }

  addFromMeta(itemsMeta || {})

  if (Array.isArray(legacyImages)) {
    for (const entry of legacyImages) {
      if (isBannedHost(hostFromCandidates(entry?.host, entry?.pageUrl, entry?.src))) continue
      const image = upsertImage(imageMap, entry)
      if (!image) continue
      const product = upsertProduct(productMap, entry?.pageUrl || '')
      mergeProducts(product, image, entry)
    }
  }

  if (Array.isArray(legacyProducts)) {
    for (const legacy of legacyProducts) {
      if (isBannedHost(hostFromCandidates(legacy?.pageUrl))) continue
      const product = upsertProduct(productMap, legacy?.pageUrl || '')
      if (!product) continue
      if (!product.title && legacy?.title) product.title = cleanText(legacy.title)
      if (!product.firstSeen || (legacy?.firstSeen && legacy.firstSeen < product.firstSeen)) {
        product.firstSeen = legacy.firstSeen || product.firstSeen
      }
      if (!product.lastSeen || (legacy?.lastSeen && legacy.lastSeen > product.lastSeen)) {
        product.lastSeen = legacy.lastSeen || product.lastSeen
      }
      if (Array.isArray(legacy?.images)) {
        for (const img of legacy.images) {
          const normalized = upsertImage(imageMap, { ...img, pageUrl: legacy.pageUrl })
          if (!normalized) continue
          mergeProducts(product, normalized, img)
        }
      }
      if (legacy?.cache && !product.cache) product.cache = deepClean(legacy.cache)
      if (Array.isArray(legacy?.urls) && !product.urls) {
        product.urls = legacy.urls.slice(0, 8).map(cleanText)
      }
    }
  }

  let allImages = Array.from(imageMap.values()).sort((a, b) => a.id.localeCompare(b.id))
  allImages = allImages.filter((image) =>
    !isBannedHost(hostFromCandidates(image.host, image.pageUrl, image.src))
  )

  let allProducts = Array.from(productMap.values()).map((product) => ({
    ...product,
    images: product.images.sort((a, b) => a.id.localeCompare(b.id)),
  })).sort((a, b) => (b.images.length - a.images.length) || a.pageUrl.localeCompare(b.pageUrl))
  allProducts = allProducts.filter((product) => !isBannedHost(hostFromCandidates(product.pageUrl)))

  const duplicatesMap = new Map()
  for (const image of allImages) {
    if (!image.duplicateOf) continue
    const key = image.duplicateOf
    if (!duplicatesMap.has(key)) duplicatesMap.set(key, [])
    duplicatesMap.get(key).push(image)
  }

  const duplicates = Array.from(duplicatesMap.entries())
    .map(([canonicalId, duplicatesList]) => ({
      canonicalId,
      canonical: imageMap.get(canonicalId) || null,
      duplicates: duplicatesList.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.duplicates.length - a.duplicates.length)

  const hostStats = (() => {
    const map = new Map()
    const ensure = (host) => {
      if (!map.has(host)) {
        map.set(host, {
          host,
          images: 0,
          uniqueImages: 0,
          duplicates: 0,
          products: 0,
          pages: new Set(),
        })
      }
      return map.get(host)
    }
    for (const image of allImages) {
      const host = hostFromCandidates(image.host, image.pageUrl, image.src)
      if (!host || isBannedHost(host)) continue
      const stats = ensure(host)
      stats.images++
      if (image.duplicateOf) stats.duplicates++
      else stats.uniqueImages++
      if (image.pageUrl) stats.pages.add(image.pageUrl)
    }
    for (const product of allProducts) {
      const host = hostFromCandidates(product.pageUrl)
      if (!host || isBannedHost(host)) continue
      const stats = ensure(host)
      stats.products++
      if (product.pageUrl) stats.pages.add(product.pageUrl)
    }
    for (const meta of Object.values(itemsMeta || {})) {
      const host = hostFromCandidates(meta?.pageUrl)
      if (!host || isBannedHost(host)) continue
      const stats = ensure(host)
      if (meta?.pageUrl) stats.pages.add(meta.pageUrl)
    }
    return Array.from(map.values())
      .map((entry) => ({
        id: entry.host,
        host: entry.host,
        images: entry.images,
        uniqueImages: entry.uniqueImages,
        duplicates: entry.duplicates,
        products: entry.products,
        pages: entry.pages.size,
      }))
      .sort((a, b) => b.images - a.images || a.host.localeCompare(b.host))
  })()

  const topProducts = allProducts.slice(0, 25)

  const totals = {
    images: allImages.length,
    uniqueImages: allImages.filter((img) => !img.duplicateOf).length,
    duplicateImages: allImages.filter((img) => !!img.duplicateOf).length,
    products: allProducts.length,
    hosts: hostStats.length,
  }

  const itemsMetrics = (() => {
    let total = 0
    let active = 0
    let removed = 0
    let duplicatesCount = 0
    for (const meta of Object.values(itemsMeta || {})) {
      if (!meta) continue
      total++
      if (meta.removedAt) removed++
      else active++
      if (meta.duplicateOf) duplicatesCount++
    }
    return {
      total: summaryItemsSafe.total ?? total,
      active: summaryItemsSafe.active ?? active,
      removed: summaryItemsSafe.removed ?? removed,
      duplicates: summaryItemsSafe.duplicatesThisRun
        ?? summaryItemsSafe.duplicates
        ?? duplicatesCount,
      added: summaryItemsSafe.added ?? null,
      purged: summaryItemsSafe.purged ?? null,
      processed: summaryItemsSafe.processed ?? null,
      discovered: summaryItemsSafe.discovered ?? null,
      duplicatesThisRun: summaryItemsSafe.duplicatesThisRun ?? null,
      newItems: summaryItemsSafe.newItems ?? summaryItemsSafe.discovered ?? null,
    }
  })()

  return { allImages, allProducts, duplicates, hostStats, topProducts, totals, itemsMetrics }
}

function paginateItems(items, size = 60) {
  const list = Array.isArray(items) ? items : []
  const pageSize = Math.max(1, size)
  const totalItems = list.length
  const pageCount = totalItems === 0 ? 1 : Math.ceil(totalItems / pageSize)
  const pages = []
  for (let pageNumber = 0; pageNumber < pageCount; pageNumber++) {
    const start = pageNumber * pageSize
    const slice = list.slice(start, start + pageSize)
    const from = totalItems === 0 ? 0 : start + 1
    const to = totalItems === 0 ? 0 : start + slice.length
    pages.push({
      pageNumber,
      pageCount,
      totalItems,
      from,
      to,
      size: pageSize,
      items: slice,
    })
  }
  if (pages.length === 0) {
    pages.push({
      pageNumber: 0,
      pageCount: 1,
      totalItems: 0,
      from: 0,
      to: 0,
      size: pageSize,
      items: [],
    })
  }
  return { size: pageSize, totalItems, pageCount: pages.length, pages }
}

function buildPagination(sectionMap) {
  const entries = Object.entries(sectionMap || {})
  if (entries.length === 0) {
    return { sections: {}, pages: [{ pageNumber: 0, pageCount: 1, sections: {} }] }
  }

  const sectionMeta = {}
  let globalPageCount = 0

  for (const [key, config] of entries) {
    const { title = key, items = [], size = 60 } = config || {}
    const data = paginateItems(items, size)
    sectionMeta[key] = { title, ...data }
    globalPageCount = Math.max(globalPageCount, data.pageCount)
  }

  if (globalPageCount === 0) globalPageCount = 1

  const pages = []
  for (let pageNumber = 0; pageNumber < globalPageCount; pageNumber++) {
    const sections = {}
    for (const [key, meta] of Object.entries(sectionMeta)) {
      const pageEntry = meta.pages[pageNumber] || meta.pages[meta.pages.length - 1] || {
        pageNumber,
        pageCount: meta.pageCount,
        totalItems: meta.totalItems,
        from: 0,
        to: 0,
        size: meta.size,
        items: [],
      }
      sections[key] = {
        title: meta.title,
        pageNumber: pageEntry.pageNumber,
        pageCount: pageEntry.pageCount,
        totalItems: pageEntry.totalItems,
        from: pageEntry.from,
        to: pageEntry.to,
        size: pageEntry.size,
        items: pageEntry.items,
      }
    }
    pages.push({ pageNumber, pageCount: globalPageCount, sections })
  }

  const sections = {}
  for (const [key, meta] of Object.entries(sectionMeta)) {
    sections[key] = {
      title: meta.title,
      size: meta.size,
      totalItems: meta.totalItems,
      pageCount: meta.pageCount,
    }
  }

  return { sections, pages }
}

function makeBreakdown(counts, meta, total) {
  return Object.entries(counts).map(([key, count]) => {
    const m = meta[key] || { label: key, tone: 'info', issue: false }
    const pct = total ? (count / total) * 100 : 0
    return {
      key,
      label: m.label,
      tone: m.tone,
      issue: m.issue,
      count,
      pct: Math.round(pct * 10) / 10,
    }
  }).sort((a, b) => {
    const toneRank = { error: 0, warn: 1, info: 2, ok: 3 }
    const td = (toneRank[a.tone] ?? 4) - (toneRank[b.tone] ?? 4)
    if (td !== 0) return td
    return b.count - a.count
  })
}

function classifyDocContent(filePath, previewText) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.gz') {
    return {
      category: 'gzip',
      label: 'Compressed (.gz)',
      tone: 'warn',
      isIssue: true,
      httpStatus: null,
      httpLabel: '',
    }
  }
  const text = (previewText || '').trim()
  if (!text) {
    return {
      category: 'empty',
      label: 'Empty response',
      tone: 'error',
      isIssue: true,
      httpStatus: null,
      httpLabel: '',
    }
  }
  if (/<!doctype html|<html/i.test(text.substring(0, 200))) {
    const status = extractHttpStatus(text)
    return {
      category: 'html-error',
      label: status ? `${status.code ?? ''} ${status.reason ?? ''}`.trim() : 'HTML error page',
      tone: 'error',
      isIssue: true,
      httpStatus: status?.code ?? null,
      httpLabel: status ? `${status.code ?? ''} ${status.reason ?? ''}`.trim() : 'HTML error page',
    }
  }
  if (text.startsWith('{') || text.startsWith('[')) {
    const status = extractHttpStatus(text)
    const isError = !!status && typeof status.code === 'number' && status.code >= 400
    const label = status ? `${status.code ?? ''} ${status.reason ?? ''}`.trim() : 'JSON payload'
    return {
      category: isError ? 'json-error' : 'json',
      label,
      tone: isError ? 'error' : 'info',
      isIssue: !!isError,
      httpStatus: status?.code ?? null,
      httpLabel: label,
    }
  }
  if (/^<\?xml/i.test(text) || /^<(urlset|sitemapindex|feed|rss)\b/i.test(text)) {
    return {
      category: 'xml',
      label: 'XML document',
      tone: 'ok',
      isIssue: false,
      httpStatus: null,
      httpLabel: '',
    }
  }
  if (/user-agent|disallow|allow/i.test(text)) {
    return {
      category: 'robots-txt',
      label: 'Robots/text directives',
      tone: 'info',
      isIssue: false,
      httpStatus: null,
      httpLabel: '',
    }
  }
  if (/[a-z]/i.test(text)) {
    return {
      category: 'text',
      label: 'Plain text',
      tone: 'info',
      isIssue: false,
      httpStatus: null,
      httpLabel: '',
    }
  }
  return {
    category: 'unknown',
    label: 'Unclassified',
    tone: 'warn',
    isIssue: true,
    httpStatus: null,
    httpLabel: '',
  }
}

async function generateReport() {
  const baseHref = '/content/projects/lv-images/generated/lv/'
  const bundle = await readBundleDataset()

  if (!bundle.ok || !bundle.dataset) {
    const reason = bundle.reason || 'missing-bundle'
    const warningCode = reason === 'lfs-pointer' ? 'bundle-lfs-pointer' : 'missing-archive'
    const fallbackDataset = {
      manifest: null,
      manifestHref: '',
      archiveHref: '/content/projects/lv-images/generated/lv.bundle.tgz',
      archiveExists: false,
      totals: {},
      flags: [],
      capture: [],
      summaryTotals: null,
      bundleLabel: null,
      runMode: null,
      warnings: [warningCode],
      history: null,
      ndjson: { count: 0, totalBytes: 0, latestShard: null, shards: [] },
    }
    return {
      __lvreportFallbackReason: reason,
      baseHref,
      summary: {},
      sitemaps: [],
      docs: [],
      robots: [],
      sample: [],
      metrics: {
        robots: { total: 0, issues: 0, breakdown: [] },
        docs: { total: 0, issues: 0, breakdown: [] },
        items: {
          total: 0,
          active: 0,
          duplicates: 0,
          removed: 0,
          added: null,
          purged: null,
          processed: null,
          discovered: null,
          newItems: null,
          duplicatesThisRun: null,
        },
      },
      allImages: [],
      allProducts: [],
      duplicates: [],
      hostStats: [],
      topProducts: [],
      totals: {},
      dataset: fallbackDataset,
      runsHistory: [],
      pagination: {},
      pages: [{ pageNumber: 0, pageCount: 1, sections: {} }],
      search: {
        documents: [],
        index: null,
        options: MINI_SEARCH_OPTIONS,
        datasetHref: `${baseHref}lvreport.dataset.json`,
        documentCount: 0,
        error: reason,
      },
    }
  }

  const summary = bundle.dataset.summary || {}
  const urlmeta = bundle.dataset.urlmeta || {}
  const itemsMeta = bundle.dataset.itemsMeta || {}
  const legacyAllImages = Array.isArray(bundle.dataset.allImages) ? bundle.dataset.allImages : []
  const legacyAllProducts = Array.isArray(bundle.dataset.allProducts)
    ? bundle.dataset.allProducts
    : []
  const runsHistory = Array.isArray(bundle.dataset.runsHistory) ? bundle.dataset.runsHistory : []

  const searchDocuments = []
  const rev = normalizeUrlmetaMap(urlmeta)

  const sitemapsLog = Array.isArray(summary?.sitemaps) ? summary.sitemaps : []
  const sitemaps = sitemapsLog.map((s, index) => {
    const url = cleanText(s.url || '')
    const um = urlmeta[url] || {}
    const savedPath = um.path ? um.path.replace(/\\/g, '/').replace(/^.*generated\/lv\//, '') : ''
    const id = `sitemap-${index}`
    const type = classifySitemap(url)
    pushSearchDoc(searchDocuments, {
      id,
      section: 'sitemaps',
      title: cleanText(s.host || url || 'Sitemap'),
      description: url,
      href: savedPath ? `${baseHref}${savedPath}` : url,
      badge: type,
      tags: ['sitemap', type].filter(Boolean),
      meta: { status: um.status ?? '', itemCount: s.itemCount || 0 },
    })
    return {
      id,
      host: s.host || '',
      url,
      type,
      imageCount: s.itemCount || 0,
      status: um.status ?? '',
      savedPath,
    }
  })

  const docs = []
  const docCounts = Object.create(null)
  let docIndex = 0
  const docsSource = buildDocsArray(bundle.dataset.docs, rev)
  for (const doc of docsSource) {
    const relPath = doc.relPath || ''
    const kind = /\.xml(\.gz)?$/i.test(relPath)
      ? 'xml'
      : /\.txt$/i.test(relPath)
      ? 'txt'
      : /\.gz$/i.test(relPath)
      ? 'gz'
      : 'doc'
    const host = doc.host
      || (() => {
        try {
          return new URL(doc.url || '').host
        } catch {
          const parts = relPath.split('/')
          return parts.length > 1 ? parts[1] : ''
        }
      })()
    const classification = classifyDocContent(relPath, doc.preview)
    docCounts[classification.category] = (docCounts[classification.category] || 0) + 1
    const preview = ((t, m = 360) => {
      const trimmed = (t || '').trim()
      if (trimmed.length <= m) return trimmed
      return `${trimmed.slice(0, m).trim()}…`
    })(doc.preview, 360)
    const record = {
      id: `doc-${docIndex++}`,
      host,
      kind,
      url: doc.url || '',
      status: doc.status ?? '',
      contentType: doc.contentType || '',
      savedPath: relPath,
      fileName: relPath ? path.posix.basename(relPath) : '',
      sizeBytes: doc.sizeBytes || 0,
      sizeLabel: formatBytes(doc.sizeBytes || 0),
      statusCategory: classification.category,
      statusLabel: classification.label,
      statusTone: classification.tone,
      httpStatus: classification.httpStatus ?? null,
      httpLabel: classification.httpLabel || '',
      isIssue: classification.isIssue,
      preview,
    }
    docs.push(record)
    pushSearchDoc(searchDocuments, {
      id: record.id,
      section: 'docs',
      title: cleanText(
        `${record.host} ${record.fileName}`.trim() || record.fileName || 'Cached doc',
      ),
      description: record.url,
      href: record.savedPath ? `${baseHref}${record.savedPath}` : record.url,
      badge: record.kind,
      tags: [record.kind, record.statusCategory].filter(Boolean),
      meta: { status: record.status, contentType: record.contentType, size: record.sizeLabel },
    })
  }
  docs.sort((a, b) => a.host.localeCompare(b.host) || a.savedPath.localeCompare(b.savedPath))

  const robotsSources = collectRobotsEntries(bundle.dataset)
  const robotsMap = new Map(robotsSources.map((entry) => [entry.host, entry]))
  const robotsHosts = new Set()
  for (const entry of robotsSources) if (entry.host) robotsHosts.add(entry.host)
  for (const sitemap of sitemaps) if (sitemap.host) robotsHosts.add(sitemap.host)
  for (const doc of docs) if (doc.host) robotsHosts.add(doc.host)
  const allHosts = Array.from(robotsHosts).sort()

  const robots = []
  const robotsCounts = Object.create(null)
  let robotIndex = 0
  for (const host of allHosts) {
    const source = robotsMap.get(host) || { text: '', relPath: '', decoded: null, sizeBytes: 0 }
    const rawText = source.text || ''
    const decoded = source.decoded || null
    const parsed = decoded?.parsed
      ? decoded.parsed
      : rawText
      ? parseRobots(rawText)
      : {
        groups: [],
        merged: { allow: [], disallow: [], noindex: [], crawlDelay: null, sitemaps: [] },
        other: {},
        hasRules: false,
      }
    const classification = classifyRobotsResponse(rawText || '', !!rawText)
    robotsCounts[classification.category] = (robotsCounts[classification.category] || 0) + 1
    const sizeBytes = source.sizeBytes || (rawText ? Buffer.byteLength(rawText, 'utf8') : 0)
    const record = {
      id: `robot-${robotIndex++}`,
      host,
      hasCached: !!rawText,
      robotsTxtPath: source.relPath || '',
      rawText,
      linesTotal: decoded?.lines?.length || (rawText ? rawText.split(/\r?\n/).length : 0),
      parsed,
      blacklisted: !!(summary?.blacklist?.[host]),
      blacklistUntil: summary?.blacklist?.[host]?.untilISO || '',
      blacklistReason: summary?.blacklist?.[host]?.reason || '',
      fileName: source.relPath ? path.posix.basename(source.relPath) : '',
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      statusCategory: classification.category,
      statusLabel: classification.label,
      statusTone: classification.tone,
      httpStatus: classification.httpStatus ?? null,
      httpLabel: classification.httpLabel || '',
      isIssue: classification.isIssue,
      preview: truncatePreview(rawText, 360),
    }
    robots.push(record)
    pushSearchDoc(searchDocuments, {
      id: record.id,
      section: 'robots',
      title: cleanText(`${host} robots.txt`),
      description: classification.httpLabel || classification.label,
      href: record.robotsTxtPath ? `${baseHref}${record.robotsTxtPath}` : '',
      badge: classification.category,
      tags: [classification.category, classification.tone].filter(Boolean),
      meta: { hasCached: record.hasCached, lines: record.linesTotal, isIssue: record.isIssue },
    })
  }

  const aggregates = buildAggregates({
    itemsMeta,
    legacyImages: legacyAllImages,
    legacyProducts: legacyAllProducts,
    summaryItems: summary?.items || {},
  })

  const { sections: paginationSections, pages } = buildPagination({
    sitemaps: { title: 'Sitemaps', items: sitemaps, size: 60 },
    docs: { title: 'Cached documents', items: docs, size: 40 },
    robots: { title: 'Robots.txt', items: robots, size: 50 },
    duplicates: { title: 'Duplicate images', items: aggregates.duplicates, size: 40 },
    topProducts: { title: 'Top products', items: aggregates.topProducts, size: 30 },
    hostStats: { title: 'Host statistics', items: aggregates.hostStats, size: 40 },
  })

  for (const [index, image] of aggregates.allImages.slice(0, 400).entries()) {
    if (isBannedHost(hostFromCandidates(image.host, image.pageUrl, image.src))) continue
    pushSearchDoc(searchDocuments, {
      id: `image-${index}`,
      section: 'images',
      title: image.title || image.basename || image.src || image.id,
      description: image.pageUrl || image.src,
      href: image.pageUrl || image.src,
      badge: image.duplicateOf ? 'duplicate' : 'image',
      tags: [image.host, image.duplicateOf ? 'duplicate' : 'unique'].filter(Boolean),
      meta: { firstSeen: image.firstSeen, lastSeen: image.lastSeen },
    })
  }

  for (const duplicate of aggregates.duplicates.slice(0, 120)) {
    const canonicalHost = hostFromCandidates(
      duplicate.canonical?.host,
      duplicate.canonical?.pageUrl,
      duplicate.canonical?.src,
    )
    if (isBannedHost(canonicalHost)) continue
    pushSearchDoc(searchDocuments, {
      id: `duplicate-${duplicate.canonicalId}`,
      section: 'duplicates',
      title: duplicate.canonical?.title || duplicate.canonical?.basename || duplicate.canonicalId,
      description: duplicate.canonical?.pageUrl || duplicate.canonical?.src
        || duplicate.canonicalId,
      href: duplicate.canonical?.pageUrl || duplicate.canonical?.src || '',
      badge: `×${duplicate.duplicates.length + 1}`,
      tags: ['duplicate'],
      meta: { duplicateCount: duplicate.duplicates.length },
    })
  }

  for (const [index, product] of aggregates.topProducts.entries()) {
    if (isBannedHost(hostFromCandidates(product.pageUrl))) continue
    pushSearchDoc(searchDocuments, {
      id: `product-${index}`,
      section: 'products',
      title: product.title || product.pageUrl || `Product ${index + 1}`,
      description: product.pageUrl,
      href: product.pageUrl && /^https?:/i.test(product.pageUrl) ? product.pageUrl : '',
      badge: 'product',
      tags: [String(product.images.length), 'images'],
      meta: {
        imageCount: product.images.length,
        firstSeen: product.firstSeen,
        lastSeen: product.lastSeen,
      },
    })
  }

  for (const [index, host] of aggregates.hostStats.slice(0, 40).entries()) {
    pushSearchDoc(searchDocuments, {
      id: `host-${index}`,
      section: 'hosts',
      title: host.host,
      description: `${host.images} images`,
      href: '',
      badge: 'host',
      tags: ['host'],
      meta: {
        imageCount: host.images,
        duplicateCount: host.duplicates,
        productCount: host.products,
        pages: host.pages,
      },
    })
  }

  const robotsMetrics = {
    total: robots.length,
    issues: robots.filter((r) => r.isIssue).length,
    breakdown: makeBreakdown(robotsCounts, ROBOTS_CATEGORY_META, robots.length),
  }
  robotsMetrics.issuePct = robotsMetrics.total
    ? (robotsMetrics.issues / robotsMetrics.total) * 100
    : 0

  const docsMetrics = {
    total: docs.length,
    issues: docs.filter((d) => d.isIssue).length,
    breakdown: makeBreakdown(
      (() => {
        const counts = Object.create(null)
        for (const d of docs) counts[d.statusCategory] = (counts[d.statusCategory] || 0) + 1
        return counts
      })(),
      DOC_CATEGORY_META,
      docs.length,
    ),
  }
  docsMetrics.issuePct = docsMetrics.total ? (docsMetrics.issues / docsMetrics.total) * 100 : 0

  const ndjsonMeta = bundle.stats?.ndjson
    || { count: 0, totalBytes: 0, latestShard: null, shards: [] }
  const datasetManifest = enrichManifest({
    archive: {
      size: bundle.archive?.sizeBytes ?? null,
      sizeBytes: bundle.archive?.sizeBytes ?? null,
      sizeLabel: bundle.archive?.sizeBytes != null ? formatBytes(bundle.archive.sizeBytes) : null,
      sha256: bundle.archive?.sha256 || null,
      shaPreview: bundle.archive?.sha256 ? String(bundle.archive.sha256).slice(0, 16) : null,
    },
    dataset: {
      fileCount: bundle.stats?.fileCount ?? null,
      totalBytes: bundle.stats?.totalBytes ?? null,
      sizeLabel: bundle.stats?.totalBytes != null ? formatBytes(bundle.stats.totalBytes) : null,
      locales: bundle.stats?.locales || [],
      ndjson: {
        count: ndjsonMeta.count,
        totalBytes: ndjsonMeta.totalBytes,
        latestShard: ndjsonMeta.latestShard,
        shards: ndjsonMeta.shards,
        sizeLabel: formatBytes(ndjsonMeta.totalBytes || 0),
      },
    },
  })

  const datasetNdjson = {
    count: ndjsonMeta.count,
    totalBytes: ndjsonMeta.totalBytes,
    sizeLabel: formatBytes(ndjsonMeta.totalBytes || 0),
    latestShard: ndjsonMeta.latestShard,
    shards: ndjsonMeta.shards,
  }

  const datasetWarnings = (bundle.warnings || []).map((warning) => warning.code || 'bundle-warning')

  const dataset = {
    manifest: datasetManifest,
    manifestHref: '',
    archiveHref: '/content/projects/lv-images/generated/lv.bundle.tgz',
    archiveExists: true,
    totals: {
      images: aggregates.totals.images,
      uniqueImages: aggregates.totals.uniqueImages,
      duplicateImages: aggregates.totals.duplicateImages,
      products: aggregates.totals.products,
      hosts: aggregates.totals.hosts,
    },
    flags: buildFlagSections(summary?.bans || {}),
    capture: summary?.capture && typeof summary.capture === 'object'
      ? Object.entries(summary.capture).map(([key, enabled]) => ({
        key,
        enabled: Boolean(enabled),
      }))
      : [],
    summaryTotals: summary?.totals ? deepClean(summary.totals) : null,
    bundleLabel: summary?.bundleLabel || null,
    runMode: summary?.runMode || null,
    warnings: datasetWarnings,
    history: null,
    ndjson: datasetNdjson,
  }
  dataset.cache = {
    pages: { totalSnapshots: summary?.totals?.pageSnapshots ?? null },
    images: { totalSnapshots: summary?.totals?.imageSnapshots ?? null },
    robotsFiles: robots.length,
    sitemapFiles: sitemaps.length,
    urlmetaEntries: Object.keys(urlmeta || {}).length,
  }

  if (summary?.totals) {
    if (summary.totals.pages != null) dataset.totals.pages = summary.totals.pages
    if (summary.totals.sitemapsProcessed != null) {
      dataset.totals.sitemapsProcessed = summary.totals.sitemapsProcessed
    }
    if (summary.totals.itemsFound != null) dataset.totals.itemsFound = summary.totals.itemsFound
    if (summary.totals.newItems != null) dataset.totals.newItems = summary.totals.newItems
    if (summary.totals.pageSnapshots != null) {
      dataset.totals.pageSnapshots = summary.totals.pageSnapshots
    }
    if (summary.totals.imageSnapshots != null) {
      dataset.totals.imageSnapshots = summary.totals.imageSnapshots
    }
  }

  const runsHistoryClean = runsHistory.map((entry) => deepClean(entry)).slice(0, 10)

  let searchIndex = null
  let searchError = null
  try {
    const engine = new MiniSearch(MINI_SEARCH_OPTIONS)
    engine.addAll(searchDocuments)
    searchIndex = engine.toJSON()
  } catch (error) {
    searchError = error?.message || String(error)
  }

  const search = {
    documents: searchDocuments,
    index: searchIndex,
    options: MINI_SEARCH_OPTIONS,
    datasetHref: `${baseHref}lvreport.dataset.json`,
    documentCount: searchDocuments.length,
    error: searchError,
  }

  const rawSamples = Array.isArray(bundle.dataset?.samples) ? bundle.dataset.samples : []
  const sampleItems = rawSamples
    .filter((item) => !isBannedHost(hostFromCandidates(item?.host, item?.pageUrl, item?.src)))
    .map((item) => ({
      ...item,
      host: item?.host || hostFromCandidates(item?.pageUrl, item?.src) || '',
    }))
    .slice(0, 120)

  return {
    baseHref,
    summary: summary || {},
    sitemaps,
    docs,
    robots,
    sample: sampleItems,
    metrics: { robots: robotsMetrics, docs: docsMetrics, items: aggregates.itemsMetrics },
    allImages: aggregates.allImages,
    allProducts: aggregates.allProducts,
    duplicates: aggregates.duplicates,
    hostStats: aggregates.hostStats,
    topProducts: aggregates.topProducts,
    totals: aggregates.totals,
    dataset,
    runsHistory: runsHistoryClean,
    pagination: deepClean(paginationSections),
    pages: pages.map((page) => ({
      pageNumber: page.pageNumber,
      pageCount: page.pageCount,
      sections: deepClean(page.sections),
    })),
    search,
  }
}

export async function buildAndPersistReport({ log = null } = {}) {
  const payload = await generateReport()
  const generatedAt = new Date().toISOString()
  const record = { generatedAt, payload }
  try {
    await fs.mkdir(path.dirname(DATASET_REPORT_FILE), { recursive: true })
    await fs.writeFile(DATASET_REPORT_FILE, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
    if (typeof log === 'function') {
      const rel = path.relative(path.resolve(__dirname, '..'), DATASET_REPORT_FILE)
      const totals = payload?.totals || {}
      log(
        `lvreport dataset saved → ${rel || DATASET_REPORT_FILE} (images=${
          totals.images ?? '?'
        }, pages=${totals.pages ?? '?'})`,
      )
    }
  } catch (error) {
    if (typeof log === 'function') {
      log(`Failed to persist lvreport dataset: ${error?.message || error}`)
    }
    throw error
  }
  return { file: DATASET_REPORT_FILE, payload, generatedAt }
}

export default async function() {
  return generateReport()
}
