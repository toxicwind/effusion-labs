// update-dataset.mjs — Playwright-backed fetches + item lifecycle
//
// - Uses Playwright context.request for ALL network calls.
// - XML profile headers: accept: "application/xml,text/xml;q=0.9,*/*;q=0.2"
// - robots profile headers: accept: "text/plain,*/*;q=0.3"
// - No HEAD requests (your debugger showed HEAD=403 while GET=200).
// - If robots.txt returns HTML/403/“access denied”, we retry once via page.goto.
// - Gzip sniff/handling for .xml.gz and gzip-encoded responses.
// - Keeps your items-meta / runs-history lifecycle logic intact.

import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile, appendFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import pkg from 'bloom-filters'
import { XMLParser } from 'fast-xml-parser'
import pLimit from 'p-limit'
const { ScalableBloomFilter } = pkg

import { chromium } from 'playwright'
import { bundleDataset } from '../../../../tools/lv-images/bundle-lib.mjs'
import { resolveChromium } from '../../../../tools/resolve-chromium.mjs'
import { htmlFragmentToMarkdown } from '../../../lib/transforms/html-to-markdown.mjs'
import { decodeRobots } from './robots_decode.mjs'

/* ============================================================
   PATHS & CONFIG
   ============================================================ */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baseDir = path.join(__dirname)

const genDir = path.join(__dirname, 'generated', 'lv')
const cacheDir = path.join(genDir, 'cache')
const itemsDir = path.join(genDir, 'items')

const pageSnapshotsDir = path.join(cacheDir, 'pages')
const pageIndexPath = path.join(pageSnapshotsDir, 'index.json')
const imageCacheDir = path.join(cacheDir, 'images')
const imageIndexPath = path.join(imageCacheDir, 'index.json')
const markdownMirrorDir = path.join(genDir, 'pages-markdown')

const robotsDir = path.join(cacheDir, 'robots')
const sitemapsDir = path.join(cacheDir, 'sitemaps')
const urlmetaPath = path.join(cacheDir, 'urlmeta.json')

const itemsMetaPath = path.join(genDir, 'items-meta.json')
const runsHistoryPath = path.join(genDir, 'runs-history.json')

const hostsTxtPath = path.join(baseDir, './config/hosts.txt')
const hostsBannedPath = path.join(baseDir, './config/hosts.banned.ndjson')
const hostsActiveSnapshotPath = path.join(baseDir, './config/hosts.active.snapshot.txt')

const bloomPath = path.join(cacheDir, 'seen.bloom.json')
const summaryPath = path.join(genDir, 'summary.json')

const PAGE_HISTORY_LIMIT = 5
const IMAGE_HISTORY_LIMIT = 2

const posixify = (value) => value.split(path.sep).join('/')
const toRelativeCachePath = (inputPath) => {
  if (!inputPath) return ''
  const normalized = String(inputPath).trim()
  if (!normalized) return ''
  const unixified = normalized.replace(/\\/g, '/')
  const marker = '/generated/lv/'
  const idx = unixified.indexOf(marker)
  if (idx !== -1) {
    const tail = unixified.slice(idx + marker.length).replace(/^\/+/, '')
    if (tail) return tail
  }
  const absolute = path.isAbsolute(normalized)
    ? normalized
    : path.resolve(genDir, normalized)
  const relative = path.relative(genDir, absolute)
  if (!relative || relative.startsWith('..')) {
    return posixify(normalized)
  }
  return posixify(relative)
}

const fromRelativeCachePath = (inputPath) => {
  if (!inputPath) return ''
  const normalized = String(inputPath).trim()
  if (!normalized) return ''
  const unixified = normalized.replace(/\\/g, '/').replace(/^\/+/, '')
  return path.join(genDir, unixified)
}

/* ============================================================
   STATELESS HELPERS & UTILITIES
   ============================================================ */
const sha1 = (s) => createHash('sha1').update(String(s || '')).digest('hex')
const shortId = (src) => sha1(src).slice(0, 16)
const hostOf = (u) => {
  try {
    return new URL(u).host
  } catch {
    return ''
  }
}
const isGzipMagic = (buf) =>
  Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b
const saveJson = (p, obj) => writeFile(p, JSON.stringify(obj, null, 2), 'utf8')
const readJsonFile = async (p, fallback) => {
  try {
    const raw = await readFile(p, 'utf8')
    return raw ? JSON.parse(raw) : fallback
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}
const ensureDir = (dirPath) => mkdir(dirPath, { recursive: true })
const timestampSlug = (iso = nowIso()) => iso.replace(/[.:]/g, '-').replace(/Z$/, '')
const nowIso = () => new Date().toISOString()

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0'
const TIMEOUT_MS = 15000

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/g
const cleanText = (
  value,
) => (typeof value === 'string' ? value.replace(CONTROL_CHARS_REGEX, '').trim() : value)

const isXmlLike = (text) => {
  const t = (text || '').trimStart()
  return t.startsWith('<?xml') || /<(urlset|sitemapindex)\b/i.test(t)
}
const isHtmlLike = (text) => /^<!doctype html/i.test(text || '') || /<html[\s>]/i.test(text || '')
const detectExtension = (text, ct = '') => {
  if (/xml/i.test(ct) || isXmlLike(text)) return 'xml'
  if (/html/i.test(ct) || isHtmlLike(text)) return 'html'
  if (/text\/plain/i.test(ct)) return 'txt'
  return 'txt'
}

const parseRobotsForSitemaps = (text) =>
  (text.match(/^sitemap:\s*(.+)$/gim) || []).map((line) => line.replace(/^sitemap:\s*/i, '').trim())

const extensionFromContentType = (ct = '') => {
  const lower = String(ct).toLowerCase()
  if (lower.includes('image/jpeg') || lower.includes('image/jpg')) return '.jpg'
  if (lower.includes('image/png')) return '.png'
  if (lower.includes('image/webp')) return '.webp'
  if (lower.includes('image/avif')) return '.avif'
  if (lower.includes('image/gif')) return '.gif'
  if (lower.includes('image/svg')) return '.svg'
  if (lower.includes('image/heic')) return '.heic'
  if (lower.includes('image/heif')) return '.heif'
  if (lower.includes('image/bmp')) return '.bmp'
  if (lower.includes('image/tiff')) return '.tiff'
  return ''
}

const deriveImageExtension = (url, contentType = '') => {
  const fromCt = extensionFromContentType(contentType)
  if (fromCt) return fromCt
  try {
    const { pathname } = new URL(url)
    const ext = path.extname(pathname)
    if (ext) return ext
  } catch {}
  return '.bin'
}

const isSitemapIndex = (xml) => /<sitemapindex\b/i.test(xml)

function* iterSitemapItems(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
  })
  let root
  try {
    root = parser.parse(xmlText)
  } catch {
    root = {}
  }
  let entries = []
  if (root?.urlset?.url) {
    entries = Array.isArray(root.urlset.url) ? root.urlset.url : [root.urlset.url]
  } else if (root?.urlset) {
    entries = [root.urlset]
  } else {
    const locRegex = /<loc>(.*?)<\/loc>/gi
    let match
    while ((match = locRegex.exec(xmlText))) {
      const url = match[1].trim()
      if (url) yield { src: url, pageUrl: url, lastMod: '', title: '', itemType: 'page' }
    }
    return
  }
  for (const entry of entries) {
    const pageUrl = typeof entry?.loc === 'string' ? entry.loc : (entry?.loc?.['#text'] || '')
    const lastMod = entry?.lastmod || ''
    let rawImages = entry?.image || entry?.['image:image'] || entry?.['image']
    const images = rawImages ? (Array.isArray(rawImages) ? rawImages : [rawImages]) : []
    if (images.length) {
      for (const img of images) {
        let src = img?.loc || img?.['image:loc'] || ''
        if (src && typeof src === 'object' && src['#text']) src = String(src['#text']).trim()
        let title = img?.title || img?.caption || img?.['image:title'] || img?.['image:caption']
          || ''
        if (title && typeof title === 'object' && title['#text']) {
          title = String(title['#text']).trim()
        }
        if (src) yield { src, pageUrl, lastMod, title, itemType: 'image' }
      }
    } else if (pageUrl) {
      yield { src: pageUrl, pageUrl, lastMod, title: '', itemType: 'page' }
    }
  }
}

// cache helper: returns/accepts absolute paths
const cache = {
  pathFor: (url, ext = 'cache') => path.join(cacheDir, hostOf(url), `${sha1(url)}.${ext}`),
  async read(url) {
    for (const ext of ['xml', 'html', 'txt', 'cache']) {
      const p = this.pathFor(url, ext)
      try {
        return { text: await readFile(p, 'utf8'), path: p }
      } catch {}
    }
    return null
  },
  async write(url, content, ct) {
    const ext = detectExtension(content, ct)
    const p = this.pathFor(url, ext)
    await mkdir(path.dirname(p), { recursive: true })
    await writeFile(p, content, 'utf8')
    return p
  },
}

class NdjsonWriter {
  constructor(dir) {
    this.dir = dir
    this.shardIndex = 0
    this.shardLines = 0
    this.totalItems = 0
    this.stream = null

    // Single-file write gate: ensures only one write hits the stream at a time.
    this._queue = Promise.resolve()
  }

  async _openShard() {
    if (this.stream) await new Promise((r) => this.stream.end(r))
    this.shardIndex++
    this.shardLines = 0
    const ts = new Date().toISOString().replace(/[.:]/g, '')
    const shardPath = path.join(
      this.dir,
      `shard-${ts}-${String(this.shardIndex).padStart(3, '0')}.ndjson`,
    )

    this.stream = createWriteStream(shardPath, { flags: 'w' })
    // Remove listener ceiling to avoid benign warnings under heavy churn.
    this.stream.setMaxListeners(0)
    await once(this.stream, 'open')
  }

  // Internal helper: perform a single physical write with backpressure handling.
  async _writeLine(line) {
    if (!this.stream || this.shardLines >= 25000) await this._openShard()

    // Try a direct write first. If it returns false, wait exactly one drain.
    if (this.stream.write(line)) {
      this.shardLines++
      this.totalItems++
      return
    }

    // Backpressure path: wait for 'drain' once, then account the line.
    await once(this.stream, 'drain')
    this.shardLines++
    this.totalItems++
  }

  // Public API: queue writes so only one hits the stream at a time.
  async write(item) {
    const line = JSON.stringify(item) + '\n'
    this._queue = this._queue.then(() => this._writeLine(line))
    return this._queue
  }

  async close() {
    // Flush any queued writes before closing.
    await this._queue
    if (this.stream) await new Promise((r) => this.stream.end(r))
  }
}

async function cachePageSnapshots({
  urls = [],
  fetchPage,
  index,
  recordUrlMeta,
  forceRefresh = false,
  maxSnapshots = PAGE_HISTORY_LIMIT,
}) {
  if (!Array.isArray(urls) || urls.length === 0 || typeof fetchPage !== 'function') {
    return {
      dirty: false,
      captured: 0,
      totalSnapshots: Object.values(index?.pages || {}).reduce(
        (sum, entry) => sum + (Array.isArray(entry?.snapshots) ? entry.snapshots.length : 0),
        0,
      ),
    }
  }

  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)))
  const limiter = pLimit(4)
  let dirty = false
  let captured = 0

  if (!index.pages) index.pages = {}

  await Promise.all(
    uniqueUrls.map((url) =>
      limiter(async () => {
        const id = shortId(url)
        const host = hostOf(url) || 'unknown'
        const entry = index.pages[id] || { id, url, host, snapshots: [] }
        const snapshots = Array.isArray(entry.snapshots) ? [...entry.snapshots] : []
        const latest = snapshots[0]

        let result
        try {
          result = await fetchPage(url)
        } catch (error) {
          console.warn(`[lv-images] Failed to fetch page ${url}: ${error?.message || error}`)
          return
        }

        if (!result?.text) return

        const fetchedAt = nowIso()
        const htmlBytes = Buffer.byteLength(result.text, 'utf8')
        const contentHash = sha1(result.text)
        const needsFreshArtifacts =
          forceRefresh || !latest || (latest.hash && latest.hash !== contentHash) || !latest?.hash

        let htmlAbsPath = ''
        let markdownAbsPath = ''

        if (needsFreshArtifacts) {
          const slug = timestampSlug(fetchedAt)
          const pageDir = path.join(pageSnapshotsDir, host, id)
          await ensureDir(pageDir)
          await ensureDir(markdownMirrorDir)

          htmlAbsPath = path.join(pageDir, `${slug}.html`)
          await writeFile(htmlAbsPath, result.text, 'utf8')

          let markdown = ''
          try {
            markdown = await htmlFragmentToMarkdown(result.text, { smartTypography: false })
          } catch (error) {
            console.warn(
              `[lv-images] html→markdown conversion failed for ${url}: ${error?.message || error}`,
            )
          }

          const mdDir = path.join(markdownMirrorDir, host, id)
          await ensureDir(mdDir)
          markdownAbsPath = path.join(mdDir, `${slug}.md`)
          await writeFile(markdownAbsPath, markdown || '', 'utf8')
        } else {
          htmlAbsPath = latest?.htmlPath ? fromRelativeCachePath(latest.htmlPath) : ''
          markdownAbsPath = latest?.markdownPath ? fromRelativeCachePath(latest.markdownPath) : ''
        }

        const htmlRel = toRelativeCachePath(htmlAbsPath)
        const markdownRel = toRelativeCachePath(markdownAbsPath)

        const snapshotEntry = {
          timestamp: fetchedAt,
          htmlPath: htmlRel,
          markdownPath: markdownRel,
          status: String(result.status ?? ''),
          contentType: result.contentType || '',
          bytes: htmlBytes,
          hash: contentHash,
        }

        snapshots.unshift(snapshotEntry)
        while (snapshots.length > maxSnapshots) snapshots.pop()

        index.pages[id] = {
          id,
          url,
          host,
          snapshots,
          lastFetchedAt: fetchedAt,
        }

        if (typeof recordUrlMeta === 'function') {
          recordUrlMeta(url, htmlAbsPath, String(result.status ?? ''), result.contentType || '')
        }

        dirty = true
        captured++
      }),
    ),
  )

  const totalSnapshots = Object.values(index.pages).reduce((sum, entry) => {
    const count = Array.isArray(entry.snapshots) ? entry.snapshots.length : 0
    return sum + count
  }, 0)

  return { dirty, captured, totalSnapshots }
}

async function cacheImageSnapshots({
  images = [],
  fetchImage,
  index,
  forceRefresh = false,
  maxSnapshots = IMAGE_HISTORY_LIMIT,
}) {
  if (!Array.isArray(images) || images.length === 0 || typeof fetchImage !== 'function') {
    return { dirty: false, captured: 0, totalSnapshots: Array.isArray(index?.images) ? index.images.length : 0 }
  }

  if (!index.images) index.images = {}

  const unique = new Map()
  for (const image of images) {
    if (!image || !image.src) continue
    const canonicalId = image.duplicateOf || image.id
    if (!canonicalId) continue
    if (!unique.has(canonicalId)) {
      unique.set(canonicalId, {
        id: canonicalId,
        url: image.src,
        host: image.host || hostOf(image.src) || 'unknown',
      })
    }
  }

  const limiter = pLimit(4)
  let dirty = false
  let captured = 0

  await Promise.all(
    Array.from(unique.values()).map((record) =>
      limiter(async () => {
        const existing = index.images[record.id]
        if (!forceRefresh && existing && Array.isArray(existing.snapshots) && existing.snapshots.length > 0) {
          return
        }

        let result
        try {
          result = await fetchImage(record.url)
        } catch (error) {
          console.warn(`[lv-images] Failed to fetch image ${record.url}: ${error?.message || error}`)
          return
        }

        if (!result?.buffer || !Buffer.isBuffer(result.buffer)) return

        const fetchedAt = nowIso()
        const slug = timestampSlug(fetchedAt)
        const imageDir = path.join(imageCacheDir, record.host, record.id)
        await ensureDir(imageDir)

        const ext = deriveImageExtension(record.url, result.contentType || '')
        const filePath = path.join(imageDir, `${slug}${ext}`)
        await writeFile(filePath, result.buffer)

        const snapshots = Array.isArray(existing?.snapshots) ? [...existing.snapshots] : []
        snapshots.unshift({
          timestamp: fetchedAt,
          filePath: toRelativeCachePath(filePath),
          status: String(result.status ?? ''),
          contentType: result.contentType || '',
          bytes: result.buffer.length,
        })
        while (snapshots.length > maxSnapshots) snapshots.pop()

        index.images[record.id] = {
          id: record.id,
          url: record.url,
          host: record.host,
          snapshots,
          lastFetchedAt: fetchedAt,
        }
        dirty = true
        captured++
      })
    ),
  )

  const totalSnapshots = Object.values(index.images).reduce((sum, entry) => {
    const count = Array.isArray(entry.snapshots) ? entry.snapshots.length : 0
    return sum + count
  }, 0)

  return { dirty, captured, totalSnapshots }
}

/* ============================================================
   Playwright lifecycle (shared)
   ============================================================ */
let pwBrowser = null
let pwCtx = null

async function startPlaywright() {
  pwBrowser = await chromium.launch({
    headless: true,
    executablePath: resolveChromium(),
    args: [
      '--disable-http-cache',
      '--disk-cache-size=0',
      '--media-cache-size=0',
      '--disable-application-cache',
      '--disable-offline-auto-reload',
      '--disable-background-networking',
    ],
  })
  pwCtx = await pwBrowser.newContext({
    userAgent: USER_AGENT,
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    extraHTTPHeaders: {
      'accept-language': 'en-US,en;q=0.8',
      'cache-control': 'no-store, max-age=0, must-revalidate',
      pragma: 'no-cache',
      expires: '0',
    },
  })
  await pwCtx.setDefaultNavigationTimeout(TIMEOUT_MS)
  await pwCtx.setDefaultTimeout(TIMEOUT_MS)
}
async function stopPlaywright() {
  try {
    await pwCtx?.close()
  } catch {}
  try {
    await pwBrowser?.close()
  } catch {}
}

/* ============================================================
   THE CRAWLER CLASS
   ============================================================ */
class Crawler {
  constructor(config) {
    this.config = config
    this.limiter = pLimit(config.concurrency)
    this.seenBloom = config.initialBloom || new ScalableBloomFilter()
  }

  _headersFor(url) {
    const isRobots = /\/robots\.txt(?:$|\?)/i.test(url)
    return isRobots
      ? {
        'user-agent': USER_AGENT,
        accept: 'text/plain,*/*;q=0.3',
        'accept-language': 'en-US,en;q=0.8',
        'cache-control': 'no-store, max-age=0, must-revalidate',
        pragma: 'no-cache',
        expires: '0',
        'if-modified-since': 'Thu, 01 Jan 1970 00:00:00 GMT',
      }
      : {
        'user-agent': USER_AGENT,
        accept: 'application/xml,text/xml;q=0.9,*/*;q=0.2',
        'accept-language': 'en-US,en;q=0.8',
        'cache-control': 'no-store, max-age=0, must-revalidate',
        pragma: 'no-cache',
        expires: '0',
        'if-modified-since': 'Thu, 01 Jan 1970 00:00:00 GMT',
      }
  }

  _looksDenied(text = '') {
    const t = (text || '').toLowerCase()
    return (
      /access[\s-]denied/.test(t)
      || /unauthorized/.test(t)
      || /forbidden/.test(t)
      || /you don't have permission/.test(t)
      || /akamai/i.test(text)
      || /reference\s*#\w+/i.test(text)
    )
  }

  async _pwGet(url, { type: _type = 'auto' } = {}) {
    // 1) Primary: context.request.get with working headers
    const headers = this._headersFor(url)
    let resp = await pwCtx.request.get(url, { headers, timeout: TIMEOUT_MS })
    let status = resp.status()
    let hdrs = resp.headers()
    let body = await resp.body()

    // gzip?
    const ce = (hdrs['content-encoding'] || '').toLowerCase()
    const ct = (hdrs['content-type'] || '').toLowerCase()
    const gzHeader = /\bgzip\b/.test(ce) || /application\/x-gzip|gzip/i.test(ct)
    const gzMagic = isGzipMagic(body)
    if (gzHeader || gzMagic) {
      try {
        body = gunzipSync(body)
      } catch {}
    }
    let text = body.toString('utf8')

    // 2) robots fallback: if we got HTML/403/denied, try real page once
    const isRobots = /\/robots\.txt(?:$|\?)/i.test(url)
    if (isRobots && (status >= 400 || isHtmlLike(text) || this._looksDenied(text))) {
      const page = await pwCtx.newPage()
      try {
        const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS })
        status = r ? r.status() : status
        hdrs = r ? r.headers() : hdrs
        body = r ? await r.body() : body
        const ce2 = (hdrs['content-encoding'] || '').toLowerCase()
        const ct2 = (hdrs['content-type'] || '').toLowerCase()
        const gz2 = /\bgzip\b/.test(ce2) || /application\/x-gzip|gzip/i.test(ct2)
          || isGzipMagic(body)
        if (gz2) {
          try {
            body = gunzipSync(body)
          } catch {}
        }
        text = body.toString('utf8')
      } finally {
        await page.close().catch(() => {})
      }
    }

    // Persist cache
    const savedPath = await cache.write(url, text, hdrs['content-type'] || '')
    this.config.recordUrlMeta?.(url, savedPath, String(status), hdrs['content-type'] || '')
    return { status, text, headers: hdrs, cachePath: savedPath }
  }

  async _fetchAndCache(url, { forceRefresh = false } = {}) {
    const cached = forceRefresh ? null : await cache.read(url).catch(() => null)
    try {
      const res = await this._pwGet(url)
      return {
        text: res.text,
        fromCache: false,
        cachePath: res.cachePath,
        status: String(res.status),
        contentType: res.headers['content-type'] || '',
      }
    } catch (error) {
      if (!forceRefresh && cached) {
        console.warn(
          `[lv-images] Network error for ${url}; using cached copy (${error?.message || error}).`,
        )
        return {
          text: cached.text,
          fromCache: true,
          cachePath: cached.path,
          status: '',
          contentType: '',
          error: error?.message || String(error),
        }
      }
      return { error: error?.message || String(error) }
    }
  }

  async _discoverHost(host) {
    console.log(`\n🕵️ Discovering sitemaps for ${host}...`)
    const robotsUrl = `https://${host}/robots.txt`
    const discoveryErrors = []
    const robotsRes = await this._fetchAndCache(robotsUrl, { forceRefresh: true })

    if (robotsRes.error) {
      discoveryErrors.push(`robots.txt → ${robotsRes.error}`)
    }

    if (robotsRes.text) {
      const robotsTxtFile = path.join(robotsDir, `${host}.txt`)
      await writeFile(robotsTxtFile, robotsRes.text.replace(CONTROL_CHARS_REGEX, ''), 'utf8')
      const decoded = decodeRobots(robotsRes.text, `https://${host}`)
      const robotsJsonFile = path.join(robotsDir, `${host}.json`)
      await writeFile(robotsJsonFile, JSON.stringify(decoded, null, 2), 'utf8')
    }

    const sitemapsFromRobots = robotsRes.text ? parseRobotsForSitemaps(robotsRes.text) : []
    const foundUrls = new Set(sitemapsFromRobots)
    ;['/sitemap.xml', '/sitemap_index.xml'].forEach((v) => foundUrls.add(`https://${host}${v}`))

    const finalSitemaps = new Set()
    const queue = [...foundUrls]
    const visited = new Set()

    while (queue.length > 0) {
      const url = queue.shift()
      if (!url || visited.has(url)) continue
      visited.add(url)

      const res = await this._fetchAndCache(url, { forceRefresh: true })
      if (res?.error) {
        discoveryErrors.push(`${url} → ${res.error}`)
        continue
      }
      if (!res?.text || !isXmlLike(res.text)) continue

      if (isSitemapIndex(res.text)) {
        const childUrls = (res.text.match(/<loc>(.*?)<\/loc>/g) || []).map((s) =>
          s.replace(/<\/?loc>/g, '').trim()
        )
        childUrls.forEach((u) => {
          if (!visited.has(u)) queue.push(u)
        })
      } else {
        finalSitemaps.add(url)
      }
    }

    console.log(`   • ${host}: ${finalSitemaps.size} content sitemaps`)
    return {
      host,
      sitemaps: [...finalSitemaps],
      robotsInfo: { url: robotsUrl, found: sitemapsFromRobots.length > 0 },
      errors: discoveryErrors,
    }
  }

  async _processSitemap(url, writer, updateItemMeta) {
    const res = await this._fetchAndCache(url, { forceRefresh: true })
    if (!res?.text) {
      const reason = res?.error ? ` (${res.error})` : ''
      console.log(`  - ⚠️ Failed to refresh ${path.basename(url)}${reason}`)
      return { processed: 0, newItems: 0, duplicates: 0 }
    }
    if (res.fromCache) {
      console.log(`  - ⚠️ Using cached copy for ${path.basename(url)} (network fallback)`)
    }

    const text = res.text

    let processedCount = 0
    let newItemCount = 0
    let duplicateCount = 0
    for (const item of iterSitemapItems(text)) {
      processedCount++
      const id = shortId(item.src)
      const dupOf = updateItemMeta(id, {
        src: cleanText(item.src || ''),
        pageUrl: cleanText(item.pageUrl || ''),
        lastMod: cleanText(item.lastMod || item.lastmod || ''),
        title: cleanText(item.title || ''),
        host: hostOf(url),
        sitemap: url,
        itemType: item.itemType || 'image',
      })
      const alreadySeen = this.seenBloom.has(id)
      const isDuplicate = Boolean(dupOf) || alreadySeen
      if (!isDuplicate) {
        await writer.write({ ...item, id, host: hostOf(url), sitemap: url })
        this.seenBloom.add(id)
        newItemCount++
      } else {
        duplicateCount++
      }
    }
    console.log(
      `  - Parsed ${processedCount} items from ${
        path.basename(url)
      } (new: ${newItemCount}, duplicates: ${duplicateCount})`,
    )
    return { processed: processedCount, newItems: newItemCount, duplicates: duplicateCount }
  }

  async run(hosts, updateItemMeta) {
    console.log(`\n🔍 Starting discovery for ${hosts.length} hosts...`)
    const discoveryResults = await Promise.all(
      hosts.map((host) => this.limiter(() => this._discoverHost(host))),
    )

    const zeroSitemapResults = discoveryResults.filter(
      (result) => result && (!Array.isArray(result.sitemaps) || result.sitemaps.length === 0),
    )
    const zeroSitemapHosts = zeroSitemapResults.map((r) => r.host)

    const zeroAnalyses = await Promise.all(
      zeroSitemapResults.map(async (result) => {
        const host = result.host
        const errors = Array.isArray(result.errors) ? result.errors.filter(Boolean) : []
        if (errors.length > 0) {
          return { host, decision: 'error', errors }
        }
        const indexPath = path.join(cacheDir, host, '_index.json')
        const raw = await readFile(indexPath, 'utf8').catch(() => null)
        if (raw == null) {
          return { host, decision: 'ban', history: { status: 'missing', count: 0 } }
        }
        try {
          const parsed = JSON.parse(raw)
          const priorCount = Array.isArray(parsed?.sitemaps) ? parsed.sitemaps.length : 0
          if (priorCount > 0) {
            return { host, decision: 'history', history: { status: 'parsed', count: priorCount } }
          }
          return { host, decision: 'ban', history: { status: 'parsed', count: priorCount } }
        } catch {
          return { host, decision: 'unknown', history: { status: 'unparseable', count: 0 } }
        }
      }),
    )

    const preservedDueToHistory = zeroAnalyses
      .filter((entry) => entry.decision === 'history')
      .map((entry) => entry.host)
    const skippedDueToErrors = zeroAnalyses
      .filter((entry) => entry.decision === 'error')
      .map((entry) => entry.host)
    const errorDetails = zeroAnalyses.filter((entry) => entry.decision === 'error')
    const skippedDueToUnknownHistory = zeroAnalyses
      .filter((entry) => entry.decision === 'unknown')
      .map((entry) => entry.host)

    const bannedCandidates = zeroAnalyses
      .filter((entry) => entry.decision === 'ban')
      .map((entry) => entry.host)

    let massRemovalSafeguard = []
    let enforceableHosts = [...bannedCandidates]

    if (enforceableHosts.length && enforceableHosts.length === hosts.length) {
      massRemovalSafeguard = [...enforceableHosts]
      console.log(
        '\n⚠️ Discovery flagged zero content sitemaps for every host; skipping ban enforcement to avoid wiping hosts.txt.',
      )
      enforceableHosts = []
    }

    if (preservedDueToHistory.length > 0) {
      console.log(`\n⏪ Preserved ${preservedDueToHistory.length} host(s) with historical sitemaps:`)
      preservedDueToHistory.forEach((host) => console.log(`   - ${host}`))
    }

    if (skippedDueToUnknownHistory.length > 0) {
      console.log(
        `\n🛈 Skipped banning ${skippedDueToUnknownHistory.length} host(s) with unreadable cached discovery.`,
      )
      skippedDueToUnknownHistory.forEach((host) => console.log(`   - ${host}`))
    }

    if (errorDetails.length > 0) {
      console.log(
        `\n⚠️ Discovery errors encountered for ${errorDetails.length} host(s); bans skipped:`,
      )
      errorDetails.forEach((entry) => {
        const detail = entry.errors?.[0] || 'unknown error'
        console.log(`   - ${entry.host}: ${detail}`)
      })
    }



    const bannedResults = []
    for (const result of zeroSitemapResults) {
      const previousIndexPath = path.join(cacheDir, result.host, '_index.json')
      let previousSitemapCount = 0
      try {
        const previous = JSON.parse(await readFile(previousIndexPath, 'utf8'))
        if (Array.isArray(previous?.sitemaps)) {
          previousSitemapCount = previous.sitemaps.length
        }
      } catch {}

      if (previousSitemapCount > 0) {
        console.log(
          `   ◦ ${result.host}: preserving due to ${previousSitemapCount} previously discovered sitemap${previousSitemapCount === 1 ? '' : 's'}`,
        )
        continue
      }
      if (enforceableHosts.includes(result.host)) {
        bannedResults.push(result)
      }
    }

    const bannedHosts = bannedResults.map((r) => r.host)

    const bannedSet = new Set(bannedHosts)

    if (bannedHosts.length > 0) {
      await mkdir(path.dirname(hostsBannedPath), { recursive: true })
      const bannedAt = nowIso()
      const lines = bannedHosts
        .map((host) =>
          `${JSON.stringify({ host, reason: 'zero-content-sitemaps', discoveredAt: bannedAt })}\n`,
        )
        .join('')
      await appendFile(hostsBannedPath, lines, 'utf8')

      console.log(
        `\n🚫 Banned ${bannedHosts.length} host(s) → ${path.relative(process.cwd(), hostsBannedPath)}`,
      )
      bannedHosts.forEach((host) => console.log(`   - ${host}`))


      const updatedHosts = hosts.filter((host) => !bannedSet.has(host))
      const serialized = updatedHosts.length > 0 ? `${updatedHosts.join('\n')}\n` : ''
      await writeFile(hostsTxtPath, serialized, 'utf8')
      await writeFile(hostsActiveSnapshotPath, serialized, 'utf8')
      console.log(
        `📝 hosts.txt rewritten (active=${updatedHosts.length}, removed=${bannedHosts.length})`,
      )
    } else if (zeroSitemapResults.length > 0) {
      if (massRemovalSafeguard.length > 0) {
        console.log('\n⚠️ Zero-sitemap bans skipped due to safeguard (all hosts affected).')
      } else if (this.config.noRewriteHosts) {
        console.log('⚠️ Skipped hosts.txt rewrite due to --no-rewrite-hosts')
      } else {
        const updatedHosts = hosts.filter((host) => !bannedSet.has(host))
        const serialized = updatedHosts.length > 0 ? `${updatedHosts.join('\n')}\n` : ''
        await writeFile(hostsTxtPath, serialized, 'utf8')
        await writeFile(hostsActiveSnapshotPath, serialized, 'utf8')
        console.log(
          `📝 hosts.txt rewritten (active=${updatedHosts.length}, removed=${bannedHosts.length})`,
        )
      }
    } else {
      console.log('\n✅ No zero-sitemap hosts to ban in this run.')
    }

    // Save per-host sitemap lists
    await Promise.all(
      discoveryResults.filter(Boolean).map(async (result) => {
        const hostCacheDir = path.join(cacheDir, result.host)
        await mkdir(hostCacheDir, { recursive: true })
        const indexPath = path.join(hostCacheDir, '_index.json')
        const metadata = {
          host: result.host,
          discoveredAt: new Date().toISOString(),
          robotsInfo: result.robotsInfo,
          sitemaps: result.sitemaps,
        }
        await saveJson(indexPath, metadata)
      }),
    )

    // Process sitemaps
    const sitemapQueue = discoveryResults.filter(Boolean).flatMap((r) => r.sitemaps)
    console.log(`\n⚙️ Processing ${sitemapQueue.length} sitemaps...`)
    const writer = new NdjsonWriter(this.config.itemsDir)
    const sitemapsLog = []
    let totalProcessedThisRun = 0
    let totalNewThisRun = 0
    let duplicatesDuringRun = 0

    await Promise.all(
      sitemapQueue.map((url) =>
        this.limiter(async () => {
          const stats = await this._processSitemap(url, writer, updateItemMeta)
          totalProcessedThisRun += stats.processed
          totalNewThisRun += stats.newItems
          duplicatesDuringRun += stats.duplicates
          sitemapsLog.push({
            host: hostOf(url),
            url,
            itemCount: stats.processed,
            newItems: stats.newItems,
            duplicates: stats.duplicates,
          })
        })
      ),
    )
    await writer.close()

    return {
      generatedAt: new Date().toISOString(),
      version: '2025.09.21-pw',
      totals: {
        hosts: hosts.length,
        hostsActive: hosts.length - bannedHosts.length,
        sitemapsProcessed: sitemapsLog.length,
        itemsFound: totalProcessedThisRun,
        newItems: totalNewThisRun,
        duplicates: duplicatesDuringRun,
      },
      bans: {
        zeroContentSitemaps: bannedHosts,
        count: bannedHosts.length,
        candidates: zeroSitemapHosts,
        preservedDueToHistory,
        skippedDueToErrors,
        skippedDueToUnknownHistory,
        massRemovalSafeguardTriggered: massRemovalSafeguard.length > 0,
        massRemovalSafeguardHosts: massRemovalSafeguard,
        skippedRewrite: Boolean(this.config.noRewriteHosts && bannedHosts.length > 0),
      },
      sitemaps: sitemapsLog.sort((a, b) => b.itemCount - a.itemCount),
    }
  }
}

/* ============================================================
   MAIN EXECUTION BLOCK
   ============================================================ */
async function fetchPageSnapshot(url) {
  const headers = {
    'user-agent': USER_AGENT,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.8',
    'cache-control': 'no-store, max-age=0, must-revalidate',
    pragma: 'no-cache',
    expires: '0',
  }

  const response = await pwCtx.request.get(url, { headers, timeout: TIMEOUT_MS })
  const status = response.status()
  const hdrs = response.headers()
  let body = await response.body()
  if (isGzipMagic(body) || /\bgzip\b/.test((hdrs['content-encoding'] || '').toLowerCase())) {
    try {
      body = gunzipSync(body)
    } catch {}
  }
  const text = body.toString('utf8')
  return { text, status, contentType: hdrs['content-type'] || '' }
}

async function fetchImageBinary(url) {
  const headers = {
    'user-agent': USER_AGENT,
    accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.8',
    referer: (() => {
      try {
        return new URL(url).origin
      } catch {
        return 'https://www.louisvuitton.com/'
      }
    })(),
    'cache-control': 'no-store, max-age=0, must-revalidate',
  }

  const response = await pwCtx.request.get(url, { headers, timeout: TIMEOUT_MS })
  const buffer = await response.body()
  return {
    buffer,
    status: response.status(),
    contentType: response.headers()['content-type'] || '',
  }
}

async function main() {
  const argv = new Map(
    process.argv.slice(2).map((x) => (x.includes('=') ? x.split('=') : [x, true])),
  )
  const MAX_HOSTS = argv.has('--max-hosts') ? Number(argv.get('--max-hosts')) : Infinity
  const NO_REWRITE_HOSTS = argv.has('--no-rewrite-hosts')

  const requestedMode = String(argv.get('--mode') || 'pages').toLowerCase()
  const modeFromFlag = argv.has('--cache-images') ? 'pages-images' : requestedMode
  const normalizedMode = ['pages', 'pages-images'].includes(modeFromFlag)
    ? modeFromFlag
    : 'pages'
  const disablePages = argv.has('--no-pages')
  const runMode = disablePages ? 'metadata-only' : normalizedMode
  const captureImages = runMode === 'pages-images'
  const capturePages = runMode !== 'metadata-only'
  const forcePageRefresh = argv.has('--refresh-pages')
  const forceImageRefresh = argv.has('--refresh-images')
  const skipBundle = argv.has('--skip-bundle')
  const keepWorkdir = argv.has('--keep-workdir')
  const bundleLabel = argv.get('--bundle-label')
    ? String(argv.get('--bundle-label'))
    : captureImages
      ? 'pages-images'
      : capturePages
        ? 'pages'
        : 'metadata'

  console.log('🚀 Starting crawler (Playwright mode)...')
  console.log(
    `   Mode: ${runMode} (pages=${capturePages ? 'on' : 'off'}, images=${captureImages ? 'on' : 'off'})`,
  )
  await mkdir(cacheDir, { recursive: true })
  await mkdir(itemsDir, { recursive: true })
  await mkdir(robotsDir, { recursive: true })
  await mkdir(sitemapsDir, { recursive: true })
  await ensureDir(pageSnapshotsDir)
  await ensureDir(markdownMirrorDir)
  await ensureDir(imageCacheDir)
  await startPlaywright()

  // URL metadata recorder (with timestamp)
  const urlmeta = JSON.parse((await readFile(urlmetaPath, 'utf8').catch(() => '{}')) || '{}')
  for (const entry of Object.values(urlmeta)) {
    if (entry?.path) {
      entry.path = toRelativeCachePath(entry.path)
    }
  }
  const recordUrlMeta = (url, absPath, status = '', contentType = '') => {
    urlmeta[url] = {
      path: toRelativeCachePath(absPath),
      status,
      contentType,
      fetchedAt: new Date().toISOString(),
    }
  }

  const pageIndex = await readJsonFile(pageIndexPath, { version: 1, pages: {} })
  if (!pageIndex.pages) pageIndex.pages = {}
  pageIndex.version = 1

  const imageIndex = await readJsonFile(imageIndexPath, { version: 1, images: {} })
  if (!imageIndex.images) imageIndex.images = {}
  imageIndex.version = 1

  // Hosts
  const hosts = (await readFile(hostsTxtPath, 'utf8'))
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_HOSTS)

  // Bloom
  const bloomJSON = await readFile(bloomPath, 'utf8').catch(() => null)
  const initialBloom = bloomJSON ? ScalableBloomFilter.fromJSON(JSON.parse(bloomJSON)) : undefined

  // Items lifecycle state
  const itemsMeta = JSON.parse((await readFile(itemsMetaPath, 'utf8').catch(() => '{}')) || '{}')
  const runsHistory = JSON.parse(
    (await readFile(runsHistoryPath, 'utf8').catch(() => '[]')) || '[]',
  )

  const basenameIndex = {}
  for (const [id, meta] of Object.entries(itemsMeta)) {
    if (!meta.duplicateOf) {
      const basename = path.basename((meta.src || '').split('?')[0])
      if (basename) basenameIndex[basename] = id
    }
  }

  const seenIds = new Set()
  let newItemsCount = 0
  let duplicateItemsCount = 0

  const updateItemMeta = (id, info) => {
    seenIds.add(id)
    const now = new Date().toISOString()
    const itemType = info.itemType || 'image'
    const rawSrc = info.src || ''
    const basename = path.basename((rawSrc.split('?')[0]) || '')
    let duplicateOf = null

    if (!itemsMeta[id]) {
      if (itemType === 'image') {
        if (basename && basenameIndex[basename]) {
          duplicateOf = basenameIndex[basename]
          duplicateItemsCount++
        } else if (basename) {
          basenameIndex[basename] = id
        }
      }
      itemsMeta[id] = {
        firstSeen: now,
        lastSeen: now,
        removedAt: null,
        src: cleanText(info.src),
        pageUrl: cleanText(info.pageUrl),
        lastMod: cleanText(info.lastMod || ''),
        title: cleanText(info.title || ''),
        host: info.host || '',
        sitemap: info.sitemap || '',
        duplicateOf,
        itemType,
      }
      newItemsCount++
    } else {
      itemsMeta[id].lastSeen = now
      itemsMeta[id].src = cleanText(info.src)
      itemsMeta[id].pageUrl = cleanText(info.pageUrl)
      itemsMeta[id].lastMod = cleanText(info.lastMod || itemsMeta[id].lastMod)
      itemsMeta[id].title = cleanText(info.title || itemsMeta[id].title)
      itemsMeta[id].host = info.host || itemsMeta[id].host
      itemsMeta[id].sitemap = info.sitemap || itemsMeta[id].sitemap
      itemsMeta[id].itemType = itemType
      if (itemsMeta[id].removedAt) itemsMeta[id].removedAt = null
      duplicateOf = itemsMeta[id].duplicateOf || null
      if (!duplicateOf && itemType === 'image' && basename && !basenameIndex[basename]) {
        basenameIndex[basename] = id
      }
    }
    return duplicateOf
  }

  const config = {
    concurrency: 12,
    itemsDir,
    initialBloom,
    recordUrlMeta,
    noRewriteHosts: NO_REWRITE_HOSTS,
  }

  const crawler = new Crawler(config)
  const summary = await crawler.run(hosts, updateItemMeta)

  // Removal / purge against retained runs
  const runTimestamp = nowIso()
  let earliestRun
  if (runsHistory.length > 0) {
    const first = runsHistory[0]
    earliestRun = typeof first === 'string' ? first : first.timestamp
  } else {
    earliestRun = runTimestamp
  }

  let removedThisRun = 0
  let purgedCount = 0
  let activeCount = 0
  for (const id of Object.keys(itemsMeta)) {
    const meta = itemsMeta[id]
    if (meta.lastSeen < earliestRun) {
      delete itemsMeta[id]
      purgedCount++
      continue
    }
    if (!seenIds.has(id)) {
      if (!meta.removedAt) {
        meta.removedAt = runTimestamp
        removedThisRun++
      }
    } else {
      activeCount++
    }
  }
  const totalCount = Object.keys(itemsMeta).length

  summary.items = {
    added: newItemsCount,
    processed: Number(summary?.totals?.itemsFound ?? 0),
    discovered: Number(summary?.totals?.newItems ?? newItemsCount),
    duplicates: duplicateItemsCount,
    duplicatesThisRun: Number(summary?.totals?.duplicates ?? 0),
    removed: removedThisRun,
    purged: purgedCount,
    active: activeCount,
    total: totalCount,
  }

  // Aggregations
  const allImages = []
  const allProductsMap = {}
  for (const [id, meta] of Object.entries(itemsMeta)) {
    if (meta.lastSeen < earliestRun) continue
    const basename = path.basename((meta.src || '').split('?')[0])
    allImages.push({
      id,
      src: meta.src,
      basename,
      firstSeen: meta.firstSeen,
      lastSeen: meta.lastSeen,
      duplicateOf: meta.duplicateOf || null,
      pageUrl: meta.pageUrl,
      title: meta.title,
      host: meta.host,
    })
    const key = meta.pageUrl || ''
    if (!allProductsMap[key]) {
      allProductsMap[key] = {
        pageUrl: key,
        title: meta.title || '',
        images: [],
        firstSeen: meta.firstSeen,
        lastSeen: meta.lastSeen,
      }
    }
    const prod = allProductsMap[key]
    prod.images.push({ id, src: meta.src, duplicateOf: meta.duplicateOf || null })
    if (!prod.title && meta.title) prod.title = meta.title
    if (meta.firstSeen < prod.firstSeen) prod.firstSeen = meta.firstSeen
    if (meta.lastSeen > prod.lastSeen) prod.lastSeen = meta.lastSeen
  }
  const allProducts = Object.values(allProductsMap)

  const existingPageSnapshots = Object.values(pageIndex.pages || {}).reduce(
    (sum, entry) => sum + (Array.isArray(entry?.snapshots) ? entry.snapshots.length : 0),
    0,
  )
  const pageSnapshotResult = capturePages
    ? await cachePageSnapshots({
      urls: allProducts.map((p) => p.pageUrl).filter(Boolean),
      fetchPage: fetchPageSnapshot,
      index: pageIndex,
      recordUrlMeta,
      forceRefresh: forcePageRefresh,
    })
    : { dirty: false, captured: 0, totalSnapshots: existingPageSnapshots }

  let imageSnapshotResult
  if (captureImages) {
    imageSnapshotResult = await cacheImageSnapshots({
      images: allImages,
      fetchImage: fetchImageBinary,
      index: imageIndex,
      forceRefresh: forceImageRefresh,
    })
  } else {
    try {
      await rm(imageCacheDir, { recursive: true, force: true })
    } catch {}
    await ensureDir(imageCacheDir)
    imageIndex.images = {}
    imageSnapshotResult = { dirty: true, captured: 0, totalSnapshots: 0 }
  }

  if (pageSnapshotResult.dirty) {
    pageIndex.updatedAt = nowIso()
    await saveJson(pageIndexPath, pageIndex)
  }
  if (imageSnapshotResult.dirty) {
    imageIndex.updatedAt = nowIso()
    await saveJson(imageIndexPath, imageIndex)
  }

  for (const product of allProducts) {
    const id = shortId(product.pageUrl || '')
    const entry = pageIndex.pages?.[id]
    if (entry?.snapshots?.length) {
      const latest = entry.snapshots[0]
      product.cache = {
        latestHtml: latest.htmlPath || '',
        latestMarkdown: latest.markdownPath || '',
        fetchedAt: latest.timestamp || '',
        snapshots: entry.snapshots,
      }
    }
  }

  for (const image of allImages) {
    const canonicalId = image.duplicateOf || image.id
    const entry = imageIndex.images?.[canonicalId]
    if (entry?.snapshots?.length) {
      const latest = entry.snapshots[0]
      image.cache = {
        latestFile: latest.filePath || '',
        fetchedAt: latest.timestamp || '',
        snapshots: entry.snapshots,
      }
    }
  }

  const pageCount = allProducts.length
  const uniqueImagesCount = allImages.length
  summary.totals = summary.totals || {}
  summary.totals.pages = pageCount
  summary.totals.images = uniqueImagesCount
  summary.totals.pageSnapshots = pageSnapshotResult.totalSnapshots
  summary.totals.pageSnapshotsCaptured = pageSnapshotResult.captured
  summary.totals.imageSnapshots = imageSnapshotResult.totalSnapshots
  summary.totals.imageSnapshotsCaptured = imageSnapshotResult.captured
  summary.capture = { pages: capturePages, images: captureImages }
  summary.runMode = runMode
  summary.bundleLabel = bundleLabel

  const runRecord = {
    timestamp: runTimestamp,
    metrics: { ...summary.items },
    totals: { images: uniqueImagesCount, pages: pageCount },
    mode: runMode,
    capture: summary.capture,
  }
  runsHistory.push(runRecord)
  const MAX_RUNS = 5
  if (runsHistory.length > MAX_RUNS) runsHistory.splice(0, runsHistory.length - MAX_RUNS)

  // Persist
  await saveJson(bloomPath, crawler.seenBloom.saveAsJSON())
  await saveJson(summaryPath, summary)
  await saveJson(urlmetaPath, JSON.parse(JSON.stringify(urlmeta)))
  await saveJson(itemsMetaPath, itemsMeta)
  await saveJson(runsHistoryPath, runsHistory)

  console.log('\n🧮 Building lvreport dataset cache...')
  try {
    const lvreportModulePath = path.join(__dirname, '..', '..', '..', '_data', 'lvreport.js')
    const { buildAndPersistReport, DATASET_REPORT_FILE } = await import(
      pathToFileURL(lvreportModulePath).href
    )
    const { payload } = await buildAndPersistReport({
      log: (message) => console.log(`   ${message}`),
    })
    const totals = payload?.totals || {}
    const relPath = DATASET_REPORT_FILE
      ? path.relative(process.cwd(), DATASET_REPORT_FILE)
      : 'src/content/projects/lv-images/generated/lv/lvreport.dataset.json'
    console.log(
      `   lvreport cached → ${relPath} (images=${totals.images ?? '?'}, pages=${
        totals.pages ?? '?'
      })`,
    )
  } catch (error) {
    console.error(`\n💥 Failed to build lvreport dataset: ${error?.message || error}`)
    throw error
  }

  if (!skipBundle) {
    try {
      const manifest = await bundleDataset({
        skipIfMissing: true,
        quiet: true,
        runLabel: bundleLabel,
        mode: runMode,
      })
      if (manifest) {
        const shortHash = manifest.archive.sha256 ? manifest.archive.sha256.slice(0, 12) : ''
        console.log(
          `\n📦 Bundle updated → ${manifest.archive.path} ${
            shortHash ? `(sha256:${shortHash}…)` : ''
          }`.trim(),
        )
      }
    } catch (error) {
      console.warn(`\n⚠️ Failed to update lv bundle: ${error?.message || error}`)
    }
  } else {
    console.log('\n📦 Bundle update skipped via --skip-bundle flag.')
  }

  if (!skipBundle && !keepWorkdir) {
    console.log('\n🧹 Pruning crawler workspace (items, sitemaps, robots)...')
    const pruneTargets = [itemsDir, sitemapsDir, robotsDir]
    await Promise.all(pruneTargets.map((dir) => rm(dir, { recursive: true, force: true })))
  } else if (!skipBundle && keepWorkdir) {
    console.log('\n🧳 Workspace retained via --keep-workdir flag.')
  }

  console.log(`\n📊 Summary → ${path.relative(process.cwd(), summaryPath)}`)
  console.log(
    `   Processed: ${
      Number(summary.totals.itemsFound || 0).toLocaleString()
    } | New: ${newItemsCount.toLocaleString()} | Duplicates: ${
      Number(summary.items.duplicatesThisRun || 0).toLocaleString()
    } | Removed: ${removedThisRun.toLocaleString()} | Active: ${activeCount.toLocaleString()} | Total indexed: ${totalCount.toLocaleString()}`,
  )
  console.log(
    `   Cached pages: ${pageSnapshotResult.totalSnapshots.toLocaleString()} (${pageSnapshotResult.captured.toLocaleString()} captured this run)`,
  )
  console.log(
    `   Cached images: ${imageSnapshotResult.totalSnapshots.toLocaleString()} (${imageSnapshotResult.captured.toLocaleString()} captured this run)`,
  )

  await stopPlaywright()
}

main().catch(async (err) => {
  console.error('\n💥 FATAL ERROR:', err)
  await stopPlaywright()
  process.exitCode = 1
})
