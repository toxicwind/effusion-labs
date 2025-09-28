console.log('[lvreport] global data module loaded')

import fss from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import MiniSearch from 'minisearch'

import { cacheRemoteImage } from '../lib/cache/remote-images.mjs'

// This file is a data helper for Eleventy. It reads the summary and
// cache data produced by the crawler (update‑dataset.mjs) and exposes
// derived structures that the report template can consume. It has
// been updated to surface new lifecycle metrics (added, removed,
// active, total, duplicates, purged) introduced by the enhanced
// crawler, along with aggregated lists of unique images and products
// derived directly from the canonical item metadata shards.

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Paths into the generated LV image atlas structure. Adjust these if
// your project layout differs.
const LV_DATASET_ROOT = process.env.LV_IMAGES_DATASET_ROOT
  ? path.resolve(process.env.LV_IMAGES_DATASET_ROOT)
  : path.resolve(__dirname, '../content/projects/lv-images')
const GENERATED_DIR = path.join(LV_DATASET_ROOT, 'generated')
const LV_BASE = path.join(GENERATED_DIR, 'lv')
const CACHE_DIR = path.join(LV_BASE, 'cache')
const ROBOTS_DIR = path.join(CACHE_DIR, 'robots')
const SITEMAPS_DIR = path.join(CACHE_DIR, 'sitemaps')
const ITEMS_DIR = path.join(LV_BASE, 'items')
const PAGE_CACHE_INDEX_JSON = path.join(CACHE_DIR, 'pages', 'index.json')
const IMAGE_CACHE_INDEX_JSON = path.join(CACHE_DIR, 'images', 'index.json')
const REPORT_TEMPLATE_DIR = path.resolve(__dirname, '../content/projects/lv-images')
const SUMMARY_JSON = path.join(LV_BASE, 'summary.json')
const URLMETA_JSON = path.join(CACHE_DIR, 'urlmeta.json')
const BLACKLIST_JSON = path.join(LV_BASE, 'hosts', 'blacklist.json')
const ITEMS_META_JSON = path.join(LV_BASE, 'items-meta.json')
// Runs history file captures recent run records with metrics.  Each
// entry is an object { timestamp, metrics, totals }.  Only the last
// 5 runs are retained in update‑dataset.  This path mirrors the
// location used by the crawler.
const RUNS_HISTORY_JSON = path.join(LV_BASE, 'runs-history.json')
const BUNDLE_MANIFEST_JSON = path.join(GENERATED_DIR, 'lv.bundle.json')
const BUNDLE_ARCHIVE_PATH = path.join(GENERATED_DIR, 'lv.bundle.tgz')

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const DATA_CACHE_DIR = path.join(PROJECT_ROOT, '.cache', 'eleventy-data')
const REPORT_CACHE_FILE = path.join(DATA_CACHE_DIR, 'lvreport.json')
const DATASET_REPORT_FILE = path.join(LV_BASE, 'lvreport.dataset.json')
const CACHE_SIGNATURE_VERSION = 1
const CACHE_SIGNATURE_TARGETS = [
  SUMMARY_JSON,
  URLMETA_JSON,
  BLACKLIST_JSON,
  ITEMS_META_JSON,
  RUNS_HISTORY_JSON,
  BUNDLE_MANIFEST_JSON,
  BUNDLE_ARCHIVE_PATH,
  ITEMS_DIR,
  ROBOTS_DIR,
  SITEMAPS_DIR,
]

// Helper to load JSON files with a fallback.
async function loadJSON(p, fallback) {
  try {
    const data = await fs.readFile(p, 'utf8')
    return JSON.parse(data)
  } catch {
    return fallback
  }
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function readCachedReport() {
  try {
    const raw = await fs.readFile(REPORT_CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed?.cacheVersion !== CACHE_SIGNATURE_VERSION) {
      return null
    }
    if (!parsed.signature || parsed.payload == null) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function writeCachedReport(signature, payload) {
  try {
    await fs.mkdir(DATA_CACHE_DIR, { recursive: true })
    const body = JSON.stringify(
      {
        cacheVersion: CACHE_SIGNATURE_VERSION,
        signature,
        cachedAt: new Date().toISOString(),
        payload,
      },
      null,
      2,
    )
    await fs.writeFile(REPORT_CACHE_FILE, body, 'utf8')
  } catch (error) {
    console.warn(`[lvreport] cache write failed: ${error?.message || error}`)
  }
}

async function readDatasetReport() {
  try {
    const raw = await fs.readFile(DATASET_REPORT_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed?.cacheVersion !== CACHE_SIGNATURE_VERSION) {
      return null
    }
    if (!parsed.signature || parsed.payload == null) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function writeDatasetReport(signature, payload) {
  try {
    await fs.mkdir(LV_BASE, { recursive: true })
    const body = JSON.stringify(
      {
        cacheVersion: CACHE_SIGNATURE_VERSION,
        signature,
        cachedAt: new Date().toISOString(),
        payload,
      },
      null,
      2,
    )
    await fs.writeFile(DATASET_REPORT_FILE, body, 'utf8')
  } catch (error) {
    console.warn(`[lvreport] dataset cache write failed: ${error?.message || error}`)
  }
}

async function persistReportOutputs(
  signature,
  payload,
  { writeCache = true, writeDataset = true } = {},
) {
  const tasks = []
  if (writeCache) tasks.push(writeCachedReport(signature, payload))
  if (writeDataset) tasks.push(writeDatasetReport(signature, payload))
  await Promise.all(tasks)
}

async function statFingerprint(target) {
  try {
    const stat = await fs.stat(target)
    const mtime = Math.floor(Number(stat.mtimeMs || 0))
    if (stat.isDirectory()) {
      return `dir:${mtime}`
    }
    return `file:${stat.size}:${mtime}`
  } catch {
    return 'missing'
  }
}

async function computeSignature() {
  const entries = []
  for (const target of CACHE_SIGNATURE_TARGETS) {
    const key = path.relative(PROJECT_ROOT, target) || path.resolve(target)
    const fingerprint = await statFingerprint(target)
    entries.push([key, fingerprint])
  }
  entries.sort((a, b) => a[0].localeCompare(b[0]))
  return { version: CACHE_SIGNATURE_VERSION, entries }
}

function signaturesEqual(a, b) {
  if (!a || !b) return false
  if (a.version !== b.version) return false
  if (!Array.isArray(a.entries) || !Array.isArray(b.entries)) return false
  if (a.entries.length !== b.entries.length) return false
  for (let index = 0; index < a.entries.length; index++) {
    const [aKey, aFingerprint] = a.entries[index]
    const [bKey, bFingerprint] = b.entries[index]
    if (aKey !== bKey || aFingerprint !== bFingerprint) {
      return false
    }
  }
  return true
}

// Build a reverse lookup mapping absolute paths to URL metadata. The
// urlmeta.json file maps a URL to { path, status, contentType }. We
// need the reverse so we can decorate cached files with their source
// URL and fetch status.
function resolveUrlmetaPath(stored) {
  if (!stored) return null
  const normalized = String(stored).trim()
  if (!normalized) return null
  const candidate = path.isAbsolute(normalized)
    ? normalized
    : path.join(LV_BASE, normalized.replace(/\\/g, '/'))
  return path.resolve(candidate)
}

function buildReverseUrlmeta(urlmeta) {
  const m = new Map()
  for (const [url, meta] of Object.entries(urlmeta || {})) {
    const resolved = resolveUrlmetaPath(meta?.path)
    if (!resolved) continue
    m.set(resolved, {
      url,
      status: meta?.status ?? '',
      contentType: meta?.contentType || '',
    })
  }
  return m
}

// Recursively walk a directory tree and yield file paths. Used for
// enumerating cached sitemap documents.
async function* walk(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        yield* walk(p)
      } else {
        yield p
      }
    }
  } catch {
    // silently ignore missing dirs
  }
}

// Sample a handful of image items from the NDJSON shards for the
// report’s visual sampler. Reads at most `max` entries across all
// shards and stops early once the quota is reached.
async function sampleItems(dir, max = 60) {
  const out = []
  try {
    const names = (await fs.readdir(dir))
      .filter((n) => n.endsWith('.ndjson'))
      .sort()
    for (const name of names) {
      const full = path.join(dir, name)
      const fh = await fs.open(full, 'r')
      const stat = await fh.stat()
      // Only read the first ~1.5MB of a shard; plenty for random sampling
      const len = Math.min(stat.size, 1_500_000)
      const buf = Buffer.alloc(len)
      await fh.read(buf, 0, len, 0)
      await fh.close()
      const lines = buf.toString('utf8').split(/\r?\n/).filter(Boolean)
      for (const line of lines) {
        try {
          const obj = JSON.parse(line)
          // Only images have a src field pointing to an image URL
          if (obj && obj.src) {
            out.push(obj)
            if (out.length >= max) return out
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  } catch {
    // ignore sampling errors
  }
  return out
}

// A minimal robots.txt parser. Parses into groups of user-agent
// directives and collects allow/disallow/noindex/sitemap/crawl-delay
// fields. Unknown directives are collected into an `other` map.
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
          merged.crawlDelay = merged.crawlDelay == null ? n : Math.min(merged.crawlDelay, n)
        }
      }
      if (r.type === 'sitemap') merged.sitemaps.push(r.path)
    }
  }
  const serializableGroups = groups.map((group) => ({
    agents: Array.from(group.agents ?? []),
    rules: group.rules.map((rule) => ({ ...rule })),
  }))
  return { groups: serializableGroups, merged, other, hasRules: ruleCount > 0 }
}

// Classify sitemap URLs by content type. The crawler sets a
// human‑friendly `type` per sitemap to help filter by image/product/etc.
function classifySitemap(url) {
  const u = String(url).toLowerCase()
  if (u.includes('sitemap-image')) return 'image'
  if (u.includes('sitemap-product')) return 'product'
  if (u.includes('sitemap-content')) return 'content'
  if (u.includes('sitemap-catalog')) return 'catalog'
  if (u.endsWith('/sitemap.xml') || /\/sitemap[^/]*\.xml(\.gz)?$/.test(u)) return 'index'
  return 'other'
}

// Standard HTTP status names used when parsing HTML or JSON error pages.
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

// Categories for robots.txt responses. Each category maps to a tone
// (error, warn, ok, info) and a flag whether it’s an issue.
const ROBOTS_CATEGORY_META = {
  ok: { label: 'Valid robots.txt', tone: 'ok', issue: false },
  'html-error': { label: 'HTML error page', tone: 'error', issue: true },
  'json-error': { label: 'JSON error', tone: 'error', issue: true },
  json: { label: 'JSON payload', tone: 'info', issue: false },
  text: { label: 'Plain text (no directives)', tone: 'warn', issue: true },
  empty: { label: 'Empty response', tone: 'error', issue: true },
  'no-cache': { label: 'No cached copy', tone: 'warn', issue: true },
}

// Categories for cached documents (XML/TXT). Each maps to a tone and
// an issue flag. Note: "robots-txt" refers to a robots.txt file cached
// under SITEMAPS_DIR.
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

// Human‑friendly byte formatter.
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

// Extract a snippet (first N characters) from a large string. Used
// when storing previews of cached documents. Ensures trailing ellipsis
// if truncated.
function truncatePreview(text, max = 320) {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trim()}…`
}

// Normalize an HTML title or error reason by stripping tags and
// compressing whitespace.
function normalizeReason(reason) {
  if (!reason) return ''
  return reason.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Format a status code and reason into a single string. If code
// isn't present, returns just the reason. Used when labeling
// error pages.
function formatHttpStatus(code, reason) {
  if (!code) return normalizeReason(reason)
  const label = normalizeReason(reason) || STATUS_NAME[code] || ''
  return label ? `${code} ${label}` : String(code)
}

// Attempt to extract a status code and reason from an error page.
// Works with JSON payloads as well as HTML title/h1 elements.
function extractHttpStatus(text) {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null
  // Check JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const obj = JSON.parse(trimmed)
      if (typeof obj?.statusCode === 'number') {
        const code = obj.statusCode
        const reason = obj.error || obj.message || STATUS_NAME[code] || ''
        return { code, reason: normalizeReason(reason) }
      }
    } catch {
      // ignore JSON parse errors
    }
  }
  // Check HTML <title>
  const titleMatch = trimmed.match(/<title>\s*(\d{3})\s*([^<]*)/i)
  if (titleMatch) {
    return { code: Number(titleMatch[1]), reason: normalizeReason(titleMatch[2]) }
  }
  // Check HTML <h1>
  const h1Match = trimmed.match(/<h1>\s*(\d{3})\s*([^<]*)/i)
  if (h1Match) {
    return { code: Number(h1Match[1]), reason: normalizeReason(h1Match[2]) }
  }
  // Fallback: search for status code numbers and keywords
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
  if (code) {
    return { code, reason: reason || STATUS_NAME[code] || '' }
  }
  if (reason) {
    return { code: null, reason }
  }
  return null
}

// Classify the robots.txt payload into categories defined in
// ROBOTS_CATEGORY_META. Returns an object with category, label,
// tone, issue flag and optional HTTP status + label.
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
    const httpLabel = status ? formatHttpStatus(status.code, status.reason) : meta.label
    return {
      category: 'html-error',
      label: httpLabel,
      tone: meta.tone,
      isIssue: true,
      httpStatus: status?.code ?? null,
      httpLabel,
    }
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const status = extractHttpStatus(trimmed)
    const isError = !!status && typeof status.code === 'number' && status.code >= 400
    const category = isError ? 'json-error' : 'json'
    const meta = ROBOTS_CATEGORY_META[category] || ROBOTS_CATEGORY_META.json
    const httpLabel = status ? formatHttpStatus(status.code, status.reason) : meta.label
    return {
      category,
      label: httpLabel,
      tone: meta.tone,
      isIssue: meta.issue || isError,
      httpStatus: status?.code ?? null,
      httpLabel,
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

// Classify a cached document (XML/TXT) into categories defined in
// DOC_CATEGORY_META. Looks at file extension and contents. Returns
// category, label, tone, issue flag, and optional HTTP status.
function classifyDocContent(filePath, previewText) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.gz') {
    const meta = DOC_CATEGORY_META.gzip
    return {
      category: 'gzip',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: null,
      httpLabel: '',
    }
  }
  const text = (previewText || '').trim()
  if (!text) {
    const meta = DOC_CATEGORY_META.empty
    return {
      category: 'empty',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: null,
      httpLabel: '',
    }
  }
  if (/<!doctype html|<html/i.test(text.substring(0, 200))) {
    const status = extractHttpStatus(text)
    const meta = DOC_CATEGORY_META['html-error']
    const label = status ? formatHttpStatus(status.code, status.reason) : meta.label
    return {
      category: 'html-error',
      label,
      tone: meta.tone,
      isIssue: true,
      httpStatus: status?.code ?? null,
      httpLabel: label,
    }
  }
  if (text.startsWith('{') || text.startsWith('[')) {
    const status = extractHttpStatus(text)
    const isError = !!status && typeof status.code === 'number' && status.code >= 400
    const category = isError ? 'json-error' : 'json'
    const meta = DOC_CATEGORY_META[category] || DOC_CATEGORY_META.json
    const label = status ? formatHttpStatus(status.code, status.reason) : meta.label
    return {
      category,
      label,
      tone: meta.tone,
      isIssue: meta.issue || isError,
      httpStatus: status?.code ?? null,
      httpLabel: label,
    }
  }
  if (/^<?xml/i.test(text) || /^<(urlset|sitemapindex|feed|rss)\b/i.test(text)) {
    const meta = DOC_CATEGORY_META.xml
    return {
      category: 'xml',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: null,
      httpLabel: '',
    }
  }
  if (/user-agent|disallow|allow/i.test(text)) {
    const meta = DOC_CATEGORY_META['robots-txt']
    return {
      category: 'robots-txt',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: null,
      httpLabel: '',
    }
  }
  if (/[a-z]/i.test(text)) {
    const meta = DOC_CATEGORY_META.text
    return {
      category: 'text',
      label: meta.label,
      tone: meta.tone,
      isIssue: meta.issue,
      httpStatus: null,
      httpLabel: '',
    }
  }
  const meta = DOC_CATEGORY_META.unknown
  return {
    category: 'unknown',
    label: meta.label,
    tone: meta.tone,
    isIssue: meta.issue,
    httpStatus: null,
    httpLabel: '',
  }
}

// Compute a breakdown of categories with percentage contributions. Sorts
// error tones first, then warn, info, ok. Used for robots/doc metrics.
function makeBreakdown(counts, meta, total) {
  const list = Object.entries(counts).map(([key, count]) => {
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
  })
  const toneRank = { error: 0, warn: 1, info: 2, ok: 3 }
  return list.sort((a, b) => {
    const diff = (toneRank[a.tone] ?? 4) - (toneRank[b.tone] ?? 4)
    if (diff !== 0) return diff
    return b.count - a.count
  })
}

const PAGINATION_DEFAULT_SIZES = {
  sitemaps: 250,
  docs: 500,
  robots: 500,
  duplicates: 200,
  topProducts: 200,
  hostStats: 400,
}

const MINI_SEARCH_OPTIONS = {
  fields: ['title', 'description', 'section', 'tags'],
  storeFields: ['id', 'section', 'title', 'description', 'href', 'badge', 'tags', 'meta'],
  searchOptions: { prefix: true, fuzzy: 0.2 },
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/g

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value.replace(CONTROL_CHARS_REGEX, '').trim()
}

function hostFromUrl(input) {
  if (!input) return ''
  try {
    return new URL(String(input)).host
  } catch {
    return ''
  }
}

function buildImageProductAggregations(itemsMeta = {}) {
  const images = []
  const products = {}
  if (!itemsMeta || typeof itemsMeta !== 'object') {
    return { images, products }
  }
  for (const [id, meta] of Object.entries(itemsMeta)) {
    if (!meta || typeof meta !== 'object') continue
    const src = meta.src || ''
    const basename = path.basename(String(src).split('?')[0] || '')
    const pageUrl = meta.pageUrl || ''
    const host = meta.host || hostFromUrl(pageUrl) || hostFromUrl(src)
    images.push({
      id,
      src,
      basename,
      firstSeen: meta.firstSeen || '',
      lastSeen: meta.lastSeen || '',
      duplicateOf: meta.duplicateOf || null,
      pageUrl,
      title: meta.title || '',
      host,
    })
    if (pageUrl) {
      if (!products[pageUrl]) {
        products[pageUrl] = {
          pageUrl,
          title: meta.title || '',
          images: [],
          firstSeen: meta.firstSeen || '',
          lastSeen: meta.lastSeen || '',
        }
      }
      const prod = products[pageUrl]
      prod.images.push({ id, src, duplicateOf: meta.duplicateOf || null })
      if (!prod.title && meta.title) prod.title = meta.title
      if (meta.firstSeen && (!prod.firstSeen || meta.firstSeen < prod.firstSeen)) {
        prod.firstSeen = meta.firstSeen
      }
      if (meta.lastSeen && (!prod.lastSeen || meta.lastSeen > prod.lastSeen)) {
        prod.lastSeen = meta.lastSeen
      }
    }
  }
  return { images, products }
}

function paginateList(items, size) {
  const list = Array.isArray(items) ? items : []
  const numericSize = Number(size)
  const chunkSize = Math.max(1, Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 1)
  const totalItems = list.length
  const pageCount = Math.max(1, Math.ceil(totalItems / chunkSize))
  const pages = []
  for (let pageNumber = 0; pageNumber < pageCount; pageNumber++) {
    const start = pageNumber * chunkSize
    const end = Math.min(start + chunkSize, totalItems)
    const pageItems = list.slice(start, end)
    const from = totalItems ? start + 1 : 0
    const to = totalItems ? end : 0
    pages.push({
      pageNumber,
      pageCount,
      size: chunkSize,
      totalItems,
      items: pageItems,
      from,
      to,
      hasPrev: pageNumber > 0,
      hasNext: pageNumber < pageCount - 1,
    })
  }
  if (pages.length === 0) {
    pages.push({
      pageNumber: 0,
      pageCount: 1,
      size: chunkSize,
      totalItems: 0,
      items: [],
      from: 0,
      to: 0,
      hasPrev: false,
      hasNext: false,
    })
  }
  return { size: chunkSize, totalItems, pageCount: pages.length, pages }
}

function buildPagination(sections, overrides = {}) {
  const meta = {}
  let globalPages = 1
  for (const [key, list] of Object.entries(sections)) {
    const cfg = overrides[key] || {}
    const rawSize = typeof cfg === 'number' ? cfg : cfg?.size
    const chosenSize = Number.isFinite(rawSize) && rawSize > 0
      ? rawSize
      : PAGINATION_DEFAULT_SIZES[key] || 100
    const paged = paginateList(list, chosenSize)
    meta[key] = { ...paged, size: chosenSize }
    if (paged.pageCount > globalPages) {
      globalPages = paged.pageCount
    }
  }

  const pages = []
  for (let pageNumber = 0; pageNumber < globalPages; pageNumber++) {
    const sectionsForPage = {}
    for (const [key, details] of Object.entries(meta)) {
      const current = details.pages[pageNumber]
      if (current) {
        sectionsForPage[key] = current
      } else {
        sectionsForPage[key] = {
          pageNumber,
          pageCount: details.pageCount,
          size: details.size,
          totalItems: details.totalItems,
          items: [],
          from: 0,
          to: 0,
          hasPrev: pageNumber > 0,
          hasNext: pageNumber < details.pageCount - 1,
        }
      }
    }
    pages.push({
      pageNumber,
      pageCount: globalPages,
      sections: sectionsForPage,
    })
  }

  return { sections: meta, pages }
}

function ensureReportShape(report, { reason = 'invalid-report' } = {}) {
  if (!report || typeof report !== 'object') {
    throw new Error(`[lvreport] dataset missing (${reason})`)
  }

  const sectionsSource = {
    sitemaps: Array.isArray(report.sitemaps) ? report.sitemaps : [],
    docs: Array.isArray(report.docs) ? report.docs : [],
    robots: Array.isArray(report.robots) ? report.robots : [],
    duplicates: Array.isArray(report.duplicates) ? report.duplicates : [],
    topProducts: Array.isArray(report.topProducts) ? report.topProducts : [],
    hostStats: Array.isArray(report.hostStats) ? report.hostStats : [],
  }

  let pagination = report.pagination
  let pages = report.pages

  if (
    !pagination || typeof pagination !== 'object' || !Array.isArray(pages) || pages.length === 0
  ) {
    const { sections, pages: rebuiltPages } = buildPagination(sectionsSource)
    pagination = sections
    pages = rebuiltPages
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error(`[lvreport] dataset pages empty (${reason})`)
  }

  const totals = {
    images: Number(report?.totals?.images ?? report?.summary?.totals?.images ?? 0) || 0,
    pages: Number(report?.totals?.pages ?? report?.summary?.totals?.pages ?? 0) || 0,
    hosts: Number(report?.totals?.hosts ?? report?.summary?.totals?.hosts ?? 0) || 0,
    sitemapsProcessed:
      Number(report?.totals?.sitemapsProcessed ?? report?.summary?.totals?.sitemapsProcessed ?? 0)
      || 0,
    itemsFound: Number(report?.totals?.itemsFound ?? report?.summary?.totals?.itemsFound ?? 0) || 0,
  }

  return {
    ...report,
    totals,
    pagination,
    pages,
  }
}

function pushSearchDoc(target, doc = {}) {
  const entry = {
    id: doc.id,
    section: doc.section,
    title: cleanText(doc.title || ''),
    description: cleanText(doc.description || ''),
    href: cleanText(doc.href || ''),
    badge: cleanText(doc.badge || ''),
    tags: Array.isArray(doc.tags)
      ? doc.tags.map((tag) => cleanText(tag || '')).filter(Boolean)
      : [],
    meta: doc.meta || {},
  }
  target.push(entry)
  return entry
}

// The main data loader. Returns an object with all the data needed
// for the report template. See report.njk for details on how these
// values are consumed.
async function buildReportData() {
  // Load primary data files. Missing files are tolerated.
  const [
    summary,
    urlmeta,
    blacklist,
    itemsMeta,
    runsHistory,
    manifest,
    pageCacheIndex,
    imageCacheIndex,
  ] = await Promise.all([
    loadJSON(SUMMARY_JSON, {}),
    loadJSON(URLMETA_JSON, {}),
    loadJSON(BLACKLIST_JSON, {}),
    loadJSON(ITEMS_META_JSON, {}),
    loadJSON(RUNS_HISTORY_JSON, []),
    loadJSON(BUNDLE_MANIFEST_JSON, null),
    loadJSON(PAGE_CACHE_INDEX_JSON, { version: 1, pages: {} }),
    loadJSON(IMAGE_CACHE_INDEX_JSON, { version: 1, images: {} }),
  ])

  const { images: allImages, products: allProducts } = buildImageProductAggregations(itemsMeta)

  const bundleExists = await fileExists(BUNDLE_ARCHIVE_PATH)
  const baseHref = '/content/projects/lv-images/generated/lv/'

  const rev = buildReverseUrlmeta(urlmeta)

  // Enumerate dataset files for directory-level insights in the report.
  let datasetEntries = []
  try {
    const bundleLibPath = path.resolve(
      __dirname,
      '..',
      '..',
      'tools',
      'lv-images',
      'bundle-lib.mjs',
    )
    const bundleLibUrl = pathToFileURL(bundleLibPath)
    const datasetLib = await import(bundleLibUrl.href)
    if (typeof datasetLib.collectDatasetEntries === 'function') {
      datasetEntries = await datasetLib.collectDatasetEntries()
    }
  } catch (error) {
    console.warn(`[lvreport] dataset enumeration failed: ${error?.message || error}`)
  }

  const datasetFileCount = datasetEntries.length
  const datasetTotalBytes = datasetEntries.reduce((sum, entry) => sum + (entry?.size ?? 0), 0)

  const directoryMap = new Map()
  for (const entry of datasetEntries) {
    const rawPath = entry?.path || ''
    const [segmentRaw] = rawPath.split('/')
    const key = segmentRaw || '.'
    const current = directoryMap.get(key) || { key, fileCount: 0, totalBytes: 0, examples: [] }
    current.fileCount += 1
    current.totalBytes += entry?.size ?? 0
    if (rawPath && current.examples.length < 3) {
      current.examples.push(rawPath)
    }
    directoryMap.set(key, current)
  }

  const datasetDirectories = Array.from(directoryMap.values()).map((dir) => {
    const isRoot = dir.key === '.'
    const segment = isRoot ? '' : `${dir.key}/`
    return {
      key: dir.key,
      label: isRoot ? 'root' : dir.key,
      fileCount: dir.fileCount,
      totalBytes: dir.totalBytes,
      sizeLabel: formatBytes(dir.totalBytes),
      href: `/content/projects/lv-images/generated/lv/${segment}`,
      pathLabel: isRoot ? 'lv/' : `lv/${dir.key}/`,
      examples: dir.examples,
    }
  }).sort((a, b) => {
    if (b.totalBytes !== a.totalBytes) return b.totalBytes - a.totalBytes
    return a.label.localeCompare(b.label)
  })

  const ndjsonEntries = datasetEntries.filter((entry) =>
    entry?.path?.startsWith('items/') && entry.path.endsWith('.ndjson')
  )
  const robotsCacheFiles =
    datasetEntries.filter((entry) => entry?.path?.startsWith('cache/robots/')).length
  const sitemapCacheFiles =
    datasetEntries.filter((entry) => entry?.path?.startsWith('cache/sitemaps/')).length

  const pageCacheStats = (() => {
    const pages = pageCacheIndex?.pages || {}
    const ids = Object.keys(pages)
    let snapshots = 0
    let latest = null
    for (const entry of Object.values(pages)) {
      const list = Array.isArray(entry?.snapshots) ? entry.snapshots : []
      snapshots += list.length
      for (const snap of list) {
        if (!snap || !snap.timestamp) continue
        if (!latest || (snap.timestamp > latest.timestamp)) {
          latest = { ...snap, url: entry.url || '', id: entry.id || '' }
        }
      }
    }
    return {
      totalPages: ids.length,
      totalSnapshots: snapshots,
      latest: latest || null,
    }
  })()

  const imageCacheStats = (() => {
    const images = imageCacheIndex?.images || {}
    const ids = Object.keys(images)
    let snapshots = 0
    let latest = null
    for (const entry of Object.values(images)) {
      const list = Array.isArray(entry?.snapshots) ? entry.snapshots : []
      snapshots += list.length
      for (const snap of list) {
        if (!snap || !snap.timestamp) continue
        if (!latest || (snap.timestamp > latest.timestamp)) {
          latest = { ...snap, url: entry.url || '', id: entry.id || '' }
        }
      }
    }
    return {
      totalImages: ids.length,
      totalSnapshots: snapshots,
      latest: latest || null,
    }
  })()

  const manifestDecorated = manifest
    ? (() => {
      const sha = manifest.archive?.sha256 || ''
      return {
        generatedAt: manifest.generatedAt || null,
        mode: manifest.mode || null,
        runLabel: manifest.runLabel || null,
        dataset: {
          fileCount: manifest.dataset?.fileCount ?? null,
          totalBytes: manifest.dataset?.totalBytes ?? null,
          sizeLabel: formatBytes(manifest.dataset?.totalBytes ?? 0),
        },
        archive: {
          path: manifest.archive?.path || 'generated/lv.bundle.tgz',
          size: manifest.archive?.size ?? null,
          sizeLabel: formatBytes(manifest.archive?.size ?? 0),
          sha256: sha,
          shaPreview: sha ? sha.slice(0, 16) : '',
        },
        summary: manifest.summary || null,
        history: {
          latest: manifest.history?.latest || null,
          entries: Array.isArray(manifest.history?.entries) ? manifest.history.entries : [],
          manifestHref: manifest.history?.manifestPath
            ? `/content/projects/lv-images/${manifest.history.manifestPath}`
            : '',
        },
      }
    })()
    : null

  const dataset = {
    manifest: manifestDecorated,
    manifestHref: '/content/projects/lv-images/generated/lv.bundle.json',
    archiveHref: '/content/projects/lv-images/generated/lv.bundle.tgz',
    archiveExists: bundleExists,
    history: manifestDecorated?.history || { latest: null, entries: [], manifestHref: '' },
    totals: {
      fileCount: datasetFileCount,
      totalBytes: datasetTotalBytes,
      sizeLabel: formatBytes(datasetTotalBytes),
    },
    directories: datasetDirectories,
    ndjson: {
      count: ndjsonEntries.length,
      latestShard: ndjsonEntries.length ? ndjsonEntries[ndjsonEntries.length - 1].path : '',
    },
    cache: {
      robotsFiles: robotsCacheFiles,
      sitemapFiles: sitemapCacheFiles,
      urlmetaEntries: Object.keys(urlmeta || {}).length,
      pages: pageCacheStats,
      images: imageCacheStats,
    },
    warnings: [
      !bundleExists ? 'missing-archive' : null,
      manifestDecorated ? null : 'missing-manifest',
      datasetFileCount === 0 ? 'empty-dataset' : null,
    ].filter(Boolean),
  }

  // Build sitemap table rows from summary.sitemaps. Each entry
  // includes host, url, type (image/product/catalog/content/index/other),
  // imageCount (number of items parsed), fetch status and path to
  // cached file, if available.
  const sitemapsLog = Array.isArray(summary?.sitemaps) ? summary.sitemaps : []
  const searchDocuments = []

  const sitemaps = sitemapsLog.map((s, index) => {
    const url = cleanText(s.url || '')
    const um = urlmeta[url] || {}
    const id = `sitemaps-${index}`
    const hrefCached = um.path
      ? path.relative(LV_BASE, path.resolve(um.path)).split(path.sep).join('/')
      : ''
    const cachedHrefFull = hrefCached ? `${baseHref}${hrefCached}` : ''
    pushSearchDoc(searchDocuments, {
      id,
      section: 'sitemaps',
      title: cleanText(s.host || url || 'Sitemap'),
      description: url,
      href: cachedHrefFull || url,
      badge: classifySitemap(url),
      tags: ['sitemap', classifySitemap(url)].filter(Boolean),
      meta: { status: um.status ?? '', itemCount: s.itemCount ?? s.imageCount ?? 0 },
    })
    return {
      id,
      host: cleanText(s.host || ''),
      url,
      type: classifySitemap(url),
      imageCount: s.itemCount ?? s.imageCount ?? 0,
      status: um.status ?? '',
      savedPath: hrefCached,
    }
  })

  // Enumerate all cached XML/TXT documents for the docs explorer. For
  // each file, classify its contents (XML vs HTML error vs JSON etc.),
  // attach fetch status from urlmeta, and build a preview snippet.
  const docs = []
  let docIndex = 0
  const docCounts = Object.create(null)
  for await (const absPath of walk(SITEMAPS_DIR)) {
    if (!/\.(xml|txt|gz)$/i.test(absPath)) continue
    const meta = rev.get(path.resolve(absPath)) || {}
    const url = cleanText(meta.url || '')
    const host = (() => {
      try {
        return new URL(url).host
      } catch {
        return cleanText(path.basename(path.dirname(absPath)))
      }
    })()
    const relPath = path.relative(LV_BASE, path.resolve(absPath)).split(path.sep).join('/')
    const kind = /\.xml(\.gz)?$/i.test(absPath) ? 'xml' : /\.txt$/i.test(absPath) ? 'txt' : 'bin'
    let sizeBytes = 0
    let previewSource = ''
    if (relPath.endsWith('.gz')) {
      try {
        const stat = await fs.stat(absPath)
        sizeBytes = stat.size
      } catch {}
    } else {
      try {
        const fh = await fs.open(absPath, 'r')
        const stat = await fh.stat()
        const len = Math.min(stat.size, 4096)
        const buf = Buffer.alloc(len)
        await fh.read(buf, 0, len, 0)
        await fh.close()
        previewSource = buf.toString('utf8')
        sizeBytes = stat.size
      } catch {
        try {
          const statFallback = await fs.stat(absPath)
          sizeBytes = statFallback.size
        } catch {}
      }
    }
    const classification = classifyDocContent(relPath, previewSource)
    docCounts[classification.category] = (docCounts[classification.category] || 0) + 1
    const preview = truncatePreview(previewSource, 360)
    const id = `docs-${docIndex++}`
    docs.push({
      id,
      host,
      kind,
      url,
      status: meta.status ?? '',
      contentType: meta.contentType || '',
      savedPath: relPath,
      fileName: cleanText(path.basename(absPath)),
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      statusCategory: classification.category,
      statusLabel: classification.label,
      statusTone: classification.tone,
      httpStatus: classification.httpStatus ?? null,
      httpLabel: classification.httpLabel || '',
      isIssue: classification.isIssue,
      preview,
    })
    pushSearchDoc(searchDocuments, {
      id,
      section: 'docs',
      title: `${host || kind} document`,
      description: relPath,
      href: `${baseHref}${relPath}`,
      badge: classification.label,
      tags: ['docs', classification.category, kind].filter(Boolean),
      meta: { status: meta.status ?? '', http: classification.httpLabel || '' },
    })
  }
  docs.sort((a, b) => a.host.localeCompare(b.host) || a.savedPath.localeCompare(b.savedPath))

  // Build the robots explorer table. Join hosts from robots cache,
  // sitemap hosts and docs hosts. Read cached robots.txt files if
  // available and fallback to minimal parser if not. Decorate each
  // entry with status, counts of directives and unknown fields.
  const robotsHosts = new Set()
  try {
    const files = await fs.readdir(ROBOTS_DIR)
    for (const n of files) {
      if (n.endsWith('.txt')) robotsHosts.add(n.replace(/\.txt$/i, ''))
    }
  } catch {}
  for (const r of sitemaps) robotsHosts.add(r.host)
  for (const d of docs) robotsHosts.add(d.host)
  const allHosts = Array.from(robotsHosts).filter(Boolean).sort()

  const robots = []
  let robotsIndex = 0
  const robotsCounts = Object.create(null)
  for (const host of allHosts) {
    const robotsPath = path.join(ROBOTS_DIR, `${host}.txt`)
    let rawText = null
    try {
      rawText = await fs.readFile(robotsPath, 'utf8')
    } catch {}
    const hasCached = !!rawText
    // parse robots: attempt to use decoded JSON if available
    let parsed = null
    // Attempt to load decoded JSON if it exists alongside the txt
    try {
      const decodedPath = path.join(ROBOTS_DIR, `${host}.json`)
      const decoded = JSON.parse(await fs.readFile(decodedPath, 'utf8'))
      // flatten into merged fields for the template
      const allow = []
      const disallow = []
      const noindex = []
      const sitemapsList = decoded.summary?.sitemaps || []
      let crawlDelay = decoded.summary?.crawlDelay ?? null
      for (const g of decoded.groups || []) {
        for (const r of g.rules || []) {
          if (r.type === 'allow') allow.push(r.value)
          else if (r.type === 'disallow') disallow.push(r.value)
          else if (r.type === 'noindex') noindex.push(r.value)
          else if (r.type === 'crawl-delay') {
            const n = Number(r.value)
            if (!Number.isNaN(n)) {
              crawlDelay = crawlDelay == null ? n : Math.min(crawlDelay, n)
            }
          }
        }
      }
      const other = {}
      for (const line of decoded.lines || []) {
        if (line.type !== 'directive') continue
        const k = (line.directive || '').toLowerCase()
        if (
          !k || ['user-agent', 'allow', 'disallow', 'noindex', 'sitemap', 'crawl-delay'].includes(k)
        ) continue
        ;(other[k] ||= []).push(line.value || '')
      }
      parsed = {
        groups: decoded.groups || [],
        merged: { allow, disallow, noindex, crawlDelay, sitemaps: sitemapsList },
        other,
        hasRules: (allow.length + disallow.length + noindex.length + sitemapsList.length) > 0,
      }
    } catch {
      // fallback to minimal parser
      if (rawText) parsed = parseRobots(rawText)
      else {parsed = {
          groups: [],
          merged: { allow: [], disallow: [], noindex: [], crawlDelay: null, sitemaps: [] },
          other: {},
          hasRules: false,
        }}
    }
    const classification = classifyRobotsResponse(rawText || '', hasCached)
    robotsCounts[classification.category] = (robotsCounts[classification.category] || 0) + 1
    const sizeBytes = rawText ? Buffer.byteLength(rawText, 'utf8') : 0
    const id = `robots-${robotsIndex++}`
    const hrefCached = rawText ? path.relative(LV_BASE, robotsPath).split(path.sep).join('/') : ''
    robots.push({
      id,
      host,
      hasCached,
      robotsTxtPath: hrefCached,
      rawText: rawText || '',
      linesTotal: parsed && parsed.groups
        ? parsed.groups.reduce((sum, g) => sum + g.rules.length, 0)
        : (rawText ? rawText.split(/\r?\n/).length : 0),
      parsed,
      blacklisted: !!blacklist[host],
      blacklistUntil: blacklist[host]?.untilISO || '',
      blacklistReason: blacklist[host]?.reason || '',
      fileName: rawText ? path.basename(robotsPath) : '',
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      statusCategory: classification.category,
      statusLabel: classification.label,
      statusTone: classification.tone,
      httpStatus: classification.httpStatus ?? null,
      httpLabel: classification.httpLabel || '',
      isIssue: classification.isIssue,
      preview: truncatePreview(rawText, 360),
    })
    pushSearchDoc(searchDocuments, {
      id,
      section: 'robots',
      title: `${host} robots.txt`,
      description: classification.label,
      href: hrefCached ? `${baseHref}${hrefCached}` : `https://${host}/robots.txt`,
      badge: classification.tone,
      tags: ['robots', classification.category].filter(Boolean),
      meta: {
        directives: parsed?.merged
          ? {
            allow: parsed.merged.allow.length,
            disallow: parsed.merged.disallow.length,
            noindex: parsed.merged.noindex.length,
          }
          : {},
      },
    })
  }

  // Build breakdown metrics for robots and docs.
  const robotsMetrics = {
    total: robots.length,
    issues: robots.filter((r) => r.isIssue).length,
    breakdown: makeBreakdown(robotsCounts, ROBOTS_CATEGORY_META, robots.length),
  }
  robotsMetrics.issuePercent = robotsMetrics.total
    ? (robotsMetrics.issues * 100) / robotsMetrics.total
    : 0
  const docsMetrics = {
    total: docs.length,
    issues: docs.filter((d) => d.isIssue).length,
    breakdown: makeBreakdown(docCounts, DOC_CATEGORY_META, docs.length),
  }
  docsMetrics.issuePercent = docsMetrics.total
    ? (docsMetrics.issues * 100) / docsMetrics.total
    : 0

  // Derive items metrics from summary.items. The crawler persists
  // these counts: added, removed, duplicates (images only), purged
  // (items dropped due to history limit), active, total. If the
  // fields are missing, default to zero.
  const itemsMetrics = (() => {
    const items = summary?.items || {}
    return {
      added: items.added ?? 0,
      removed: items.removed ?? 0,
      duplicates: items.duplicates ?? 0,
      purged: items.purged ?? 0,
      active: items.active ?? 0,
      total: items.total ?? 0,
    }
  })()

  // Unique counts of images and pages. Fallback to aggregated lists if
  // summary.totals is missing these fields. Note: allImages is an
  // array, allProducts is an object keyed by page URL.
  const uniqueImagesCount = (() => {
    if (summary?.totals && typeof summary.totals.images === 'number') return summary.totals.images
    return Array.isArray(allImages) ? allImages.length : 0
  })()
  const uniquePagesCount = (() => {
    if (summary?.totals && typeof summary.totals.pages === 'number') return summary.totals.pages
    if (allProducts && typeof allProducts === 'object') return Object.keys(allProducts).length
    return 0
  })()

  // Construct a list of duplicate images grouped by their canonical id.
  // Each entry in duplicatesList represents a canonical image with one
  // or more duplicates.  We expose the canonical image's id, src,
  // basename, firstSeen, lastSeen, title, pageUrl, and a list of
  // duplicate images (ids).  The `count` field represents the total
  // number of images (canonical + duplicates).  Results are sorted by
  // descending count.
  const duplicatesList = (() => {
    const canonicalMap = {}
    if (Array.isArray(allImages)) {
      for (const img of allImages) {
        // Determine canonical id for this image.  Images with duplicateOf
        // set refer to a canonical record; otherwise the image itself
        // is canonical.  Pages are not included in allImages.
        const canonicalId = img.duplicateOf || img.id
        if (!canonicalMap[canonicalId]) {
          canonicalMap[canonicalId] = {
            id: canonicalId,
            count: 0,
            images: [],
            canonical: null,
          }
        }
        canonicalMap[canonicalId].count++
        canonicalMap[canonicalId].images.push(img)
        // Mark canonical image when encountering it
        if (!img.duplicateOf) {
          canonicalMap[canonicalId].canonical = img
        }
      }
    }
    const list = []
    for (const [cid, group] of Object.entries(canonicalMap)) {
      if (group.count > 1 && group.canonical) {
        list.push({
          id: cid,
          src: group.canonical.src,
          basename: group.canonical.basename,
          title: group.canonical.title,
          pageUrl: group.canonical.pageUrl,
          firstSeen: group.canonical.firstSeen,
          lastSeen: group.canonical.lastSeen,
          duplicates: group.images.filter((i) => i.id !== cid).map((i) => i.id),
          count: group.count,
        })
        pushSearchDoc(searchDocuments, {
          id: cid,
          section: 'duplicates',
          title: group.canonical.basename || group.canonical.title || group.canonical.pageUrl
            || 'Duplicate image',
          description: group.canonical.pageUrl || group.canonical.src,
          href: group.canonical.pageUrl || group.canonical.src,
          badge: 'duplicate',
          tags: ['duplicates', group.count > 2 ? 'heavy' : 'pair'],
          meta: { duplicateCount: group.count - 1 },
        })
      }
    }
    return list.sort((a, b) => b.count - a.count)
  })()

  // Construct a list of top products sorted by total number of images.
  // Each product entry contains pageUrl, title, total image count,
  // unique image count (non-duplicate), firstSeen, lastSeen and
  // associated images.  We sort by total image count descending so
  // pagination can surface the heaviest pages first.
  const topProducts = (() => {
    const prods = []
    if (allProducts && typeof allProducts === 'object') {
      for (const [pageKey, prod] of Object.entries(allProducts)) {
        const total = Array.isArray(prod.images) ? prod.images.length : 0
        const unique = Array.isArray(prod.images)
          ? prod.images.filter((img) => !img.duplicateOf).length
          : 0
        const resolvedPageUrl = prod.pageUrl || pageKey
        const id = `product-${prods.length}`
        prods.push({
          id,
          pageUrl: resolvedPageUrl,
          title: prod.title || resolvedPageUrl,
          totalImages: total,
          uniqueImages: unique,
          firstSeen: prod.firstSeen,
          lastSeen: prod.lastSeen,
          images: prod.images || [],
        })
        pushSearchDoc(searchDocuments, {
          id,
          section: 'products',
          title: prod.title || resolvedPageUrl,
          description: resolvedPageUrl,
          href: resolvedPageUrl,
          badge: `${unique} unique · ${total} total`,
          tags: ['product'],
          meta: { uniqueImages: unique, totalImages: total },
        })
      }
    }
    prods.sort((a, b) => b.totalImages - a.totalImages)
    return prods
  })()

  // Construct an overview of images, unique images, duplicates and pages per host.  Each
  // entry aggregates counts by top‑level domain.  Duplicates are counted per
  // host based on the duplicates list; pages are counted by grouping
  // aggregated products by their pageUrl host.  Hosts with no images
  // or pages will not appear.  Results are sorted by descending image
  // count.
  const hostStats = (() => {
    const stats = {}
    // Count images and unique images per host
    if (Array.isArray(allImages)) {
      for (const img of allImages) {
        const h = img.host || ''
        if (!stats[h]) {
          stats[h] = { host: h, images: 0, uniqueImages: 0, duplicates: 0, pages: 0 }
        }
        stats[h].images++
        if (!img.duplicateOf) {
          stats[h].uniqueImages++
        }
      }
    }
    // Count pages per host
    if (allProducts && typeof allProducts === 'object') {
      for (const pageUrl of Object.keys(allProducts)) {
        let host
        try {
          host = new URL(pageUrl).host
        } catch {
          host = ''
        }
        if (!stats[host]) {
          stats[host] = { host, images: 0, uniqueImages: 0, duplicates: 0, pages: 0 }
        }
        stats[host].pages++
      }
    }
    // Count duplicates per host based on the duplicates list
    if (Array.isArray(duplicatesList)) {
      for (const dup of duplicatesList) {
        let host
        try {
          host = new URL(dup.pageUrl).host
        } catch {
          host = ''
        }
        if (!stats[host]) {
          stats[host] = { host, images: 0, uniqueImages: 0, duplicates: 0, pages: 0 }
        }
        // duplicatesList.count includes the canonical image; subtract 1 to count only duplicate entries
        stats[host].duplicates += Math.max(0, dup.count - 1)
      }
    }
    const sorted = Object.values(stats).sort((a, b) => b.images - a.images)
    return sorted.map((entry, index) => {
      const item = { ...entry, id: `host-${index}` }
      pushSearchDoc(searchDocuments, {
        id: item.id,
        section: 'hosts',
        title: item.host || 'Unknown host',
        description: `${item.images} images (${item.uniqueImages} unique)`,
        href: '#hosts-section',
        badge: 'host',
        tags: ['hosts'],
        meta: { duplicates: item.duplicates, pages: item.pages },
      })
      return item
    })
  })()

  // Sample a few image items from NDJSON shards for the UI.
  const sampleRaw = await sampleItems(ITEMS_DIR, 60)
  const sample = await Promise.all(
    sampleRaw.map(async (entry) => {
      const src = cleanText(entry?.src || '')
      const pageUrl = cleanText(entry?.pageUrl || '')
      const title = cleanText(entry?.title || '')
      let cachedSrc = null
      try {
        cachedSrc = await cacheRemoteImage(src)
      } catch (error) {
        console.warn(`[lvreport] cache failed for ${src}: ${error?.message || error}`)
      }
      let templateRelative = null
      if (cachedSrc) {
        templateRelative = path.relative(REPORT_TEMPLATE_DIR, cachedSrc).split(path.sep).join('/')
      }
      return {
        ...entry,
        src,
        pageUrl,
        title,
        cachedSrc: templateRelative,
        cachedSrcAbsolute: cachedSrc,
        originalSrc: src || null,
      }
    }),
  )

  const hostCount = (() => {
    if (summary?.totals && typeof summary.totals.hosts === 'number') return summary.totals.hosts
    if (Array.isArray(hostStats) && hostStats.length) return hostStats.length
    if (Array.isArray(allImages)) {
      const set = new Set()
      for (const img of allImages) {
        if (img?.host) set.add(img.host)
      }
      return set.size
    }
    return 0
  })()

  const sitemapsProcessed = (() => {
    if (summary?.totals && typeof summary.totals.sitemapsProcessed === 'number') {
      return summary.totals.sitemapsProcessed
    }
    return sitemaps.length
  })()

  const itemsFound = (() => {
    if (summary?.totals && typeof summary.totals.itemsFound === 'number') {
      return summary.totals.itemsFound
    }
    return uniqueImagesCount
  })()

  const totals = {
    images: uniqueImagesCount,
    pages: uniquePagesCount,
    hosts: hostCount,
    sitemapsProcessed,
    itemsFound,
  }

  const { sections: paginationSections, pages } = buildPagination({
    sitemaps,
    docs,
    robots,
    duplicates: duplicatesList,
    topProducts,
    hostStats,
  })

  for (const page of pages) {
    if (!page || typeof page !== 'object') continue
    const sections = page.sections || {}
    for (const section of Object.values(sections)) {
      if (!section || !Array.isArray(section.items)) continue
      for (const item of section.items) {
        if (!item || typeof item !== 'object') continue
        for (const key of Object.keys(item)) {
          const value = item[key]
          if (typeof value === 'string') {
            item[key] = cleanText(value)
          }
        }
      }
    }
  }

  let searchIndexJson = null
  try {
    const mini = new MiniSearch(MINI_SEARCH_OPTIONS)
    mini.addAll(searchDocuments)
    searchIndexJson = mini.toJSON()
  } catch (error) {
    console.warn(`[lvreport] search index build failed: ${error?.message || error}`)
  }

  const search = {
    documents: searchDocuments,
    index: searchIndexJson,
    options: MINI_SEARCH_OPTIONS,
    datasetHref: '/content/projects/lv-images/generated/lv/lvreport.dataset.json',
    documentCount: searchDocuments.length,
    version: 1,
  }

  return {
    // Base HREF used by the report to link into cached files
    baseHref,
    summary,
    sitemaps,
    docs,
    robots,
    sample,
    allImages: [],
    allProducts: [],
    // Expose runs history so the report can surface a timeline of
    // previous crawls.  Each entry is { timestamp, metrics, totals }.
    runsHistory,
    // Expose duplicate images grouped by canonical id.  Each entry
    // describes a canonical image and its duplicate set.
    duplicates: duplicatesList,
    // Expose a list of top products sorted by number of images.
    topProducts,
    // Expose host statistics so the report can surface per‑host image,
    // unique image, duplicate and page counts.  Hosts with no data are
    // omitted.  Sorted by image count descending.
    hostStats,
    // Dataset map used for the vivid report header.
    dataset,
    // Expose derived metrics. robots/docs remain under metrics.
    metrics: {
      robots: robotsMetrics,
      docs: docsMetrics,
      items: itemsMetrics,
    },
    // Expose global totals for quick display
    totals,
    pagination: paginationSections,
    pages,
    search,
  }
}

export async function buildAndPersistReport({
  signature: providedSignature = null,
  writeCache = true,
  writeDataset = true,
  log = null,
} = {}) {
  const signature = providedSignature || (await computeSignature())
  const rawPayload = await buildReportData()
  const payload = ensureReportShape(rawPayload, { reason: 'build-report-invalid' })
  if (writeCache || writeDataset) {
    await persistReportOutputs(signature, payload, { writeCache, writeDataset })
  }
  if (typeof log === 'function') {
    try {
      const totals = payload?.totals || {}
      const totalImages = totals.images != null ? String(totals.images) : '?'
      const totalPages = totals.pages != null ? String(totals.pages) : '?'
      log(`[lvreport] dataset cached (images=${totalImages}, pages=${totalPages})`)
    } catch (error) {
      console.warn(`[lvreport] log callback failed: ${error?.message || error}`)
    }
  }
  return { signature, payload }
}

export default async function() {
  console.log('[lvreport] default export invoked')
  try {
    const signature = await computeSignature()

    const rebuild = async (reason) => {
      const { payload } = await buildAndPersistReport({ signature })
      const report = ensureReportShape(payload, { reason })
      if (process.env.DEBUG_LVREPORT === '1') {
        console.log(
          '[lvreport] rebuilt payload pages=',
          Array.isArray(report?.pages) ? report.pages.length : 'missing',
        )
      }
      return report
    }

    if (process.env.LVREPORT_DISABLE_CACHE === '1') {
      const { payload } = await buildAndPersistReport({
        signature,
        writeCache: false,
        writeDataset: false,
      })
      const report = ensureReportShape(payload, { reason: 'cache-disabled' })
      console.log('[lvreport] returning (cache-disabled)', {
        pages: Array.isArray(report?.pages) ? report.pages.length : 'missing',
        pagination: Object.keys(report?.pagination || {}).length,
      })
      return report
    }

    const datasetCached = await readDatasetReport()
    const datasetPayload = datasetCached?.payload
    const datasetMatch = datasetCached && signaturesEqual(signature, datasetCached.signature)
    if (datasetMatch && datasetPayload) {
      let report = ensureReportShape(datasetPayload, { reason: 'dataset-cached' })
      if (report.__lvreportFallbackReason) {
        report = await rebuild('dataset-fallback')
      } else {
        const cached = await readCachedReport()
        if (!cached || !signaturesEqual(signature, cached.signature)) {
          await writeCachedReport(signature, report)
        }
        if (process.env.DEBUG_LVREPORT === '1') {
          console.log(
            '[lvreport] dataset payload (cached) pages=',
            Array.isArray(report?.pages) ? report.pages.length : 'missing',
          )
        }
        console.log('[lvreport] returning (dataset-cached)', {
          pages: Array.isArray(report?.pages) ? report.pages.length : 'missing',
          pagination: Object.keys(report?.pagination || {}).length,
        })
        return report
      }
      return report
    }

    const cached = await readCachedReport()
    if (cached && signaturesEqual(signature, cached.signature)) {
      let report = ensureReportShape(cached.payload, { reason: 'cache-hit' })
      if (report.__lvreportFallbackReason) {
        report = await rebuild('cache-fallback')
      }
      if (process.env.DEBUG_LVREPORT === '1') {
        console.log(
          '[lvreport] cached payload pages=',
          Array.isArray(report?.pages) ? report.pages.length : 'missing',
        )
      }
      console.log('[lvreport] returning (cache-hit)', {
        pages: Array.isArray(report?.pages) ? report.pages.length : 'missing',
        pagination: Object.keys(report?.pagination || {}).length,
      })
      return report
    }

    const report = await rebuild('fresh-rebuild')
    console.log('[lvreport] returning (fresh)', {
      pages: Array.isArray(report?.pages) ? report.pages.length : 'missing',
      pagination: Object.keys(report?.pagination || {}).length,
    })
    return report
  } catch (error) {
    console.error('[lvreport] failed to load dataset:', error?.message || error)
    throw error
  }
}

export {
  computeSignature,
  DATASET_REPORT_FILE,
  readCachedReport,
  readDatasetReport,
  REPORT_CACHE_FILE,
  signaturesEqual,
  writeDatasetReport,
}
