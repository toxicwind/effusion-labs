import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, open, stat as statFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

import tarStream from 'tar-stream'

const DATASET_ROOT = path.resolve('src/content/projects/lv-images')
const BUNDLE_PATH = path.join(DATASET_ROOT, 'generated', 'lv.bundle.tgz')
const GENERATED_PREFIX = 'generated/lv/'
const PREVIEW_LIMIT = 4096
const SAMPLE_LIMIT = 60

function toDatasetPath(rawPath) {
  if (!rawPath) return ''
  const normalized = String(rawPath).replace(/\\/g, '/').replace(/^\.\/+/, '')
  const marker = normalized.indexOf(GENERATED_PREFIX)
  if (marker === -1) return normalized.replace(/^\/+/, '')
  return normalized.slice(marker + GENERATED_PREFIX.length)
}

function hostFromCachePath(relPath) {
  const parts = relPath.split('/')
  if (parts.length < 2) return ''
  return parts[1] || ''
}

async function readPointerSnippet(filePath, length = 256) {
  const fh = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await fh.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await fh.close()
  }
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export async function inspectBundle() {
  try {
    await access(BUNDLE_PATH)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { ok: false, reason: 'missing-bundle', path: BUNDLE_PATH }
    }
    throw error
  }

  const pointerCheck = await readPointerSnippet(BUNDLE_PATH)
  if (pointerCheck.startsWith('version https://git-lfs.github.com/spec/v1')) {
    return { ok: false, reason: 'lfs-pointer', path: BUNDLE_PATH }
  }

  const bundleStat = await statFile(BUNDLE_PATH)
  return {
    ok: true,
    path: BUNDLE_PATH,
    sizeBytes: bundleStat.size,
    sha256: await hashFile(BUNDLE_PATH),
    mtimeMs: bundleStat.mtimeMs,
  }
}

export async function readBundleDataset({
  previewLimit = PREVIEW_LIMIT,
  sampleLimit = SAMPLE_LIMIT,
} = {}) {
  const info = await inspectBundle()
  if (!info.ok) {
    return { ...info, dataset: null }
  }

  const stats = {
    fileCount: 0,
    totalBytes: 0,
    directories: new Set(),
    locales: new Set(),
    ndjson: { count: 0, totalBytes: 0, latestShard: null, latestMtime: 0, shards: [] },
  }

  const result = {
    summary: null,
    urlmeta: {},
    itemsMeta: {},
    allImages: [],
    allProducts: [],
    runsHistory: [],
    docs: new Map(),
    robotsTxt: new Map(),
    robotsDecoded: new Map(),
    samples: [],
    warnings: [],
  }

  const extract = tarStream.extract()

  extract.on('entry', (header, stream, next) => {
    const type = header.type
    const rawName = header.name || ''
    const relPath = toDatasetPath(rawName)

    if (type === 'directory') {
      stats.directories.add(relPath)
      stream.resume()
      stream.on('end', next)
      return
    }

    if (type !== 'file') {
      stream.resume()
      stream.on('end', next)
      return
    }

    stats.fileCount++
    stats.totalBytes += header.size || 0

    if (
      relPath.startsWith('cache/') && relPath.includes('/') && !relPath.startsWith('cache/robots/')
    ) {
      const host = hostFromCachePath(relPath)
      if (host) stats.locales.add(host)
    }

    const ext = path.extname(relPath).toLowerCase()

    if (relPath === 'summary.json') {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        try {
          result.summary = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch (error) {
          result.warnings.push({
            code: 'summary-json-error',
            message: error?.message || String(error),
          })
        }
        next()
      })
      return
    }

    if (relPath === 'cache/urlmeta.json') {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        try {
          result.urlmeta = JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}
        } catch (error) {
          result.warnings.push({
            code: 'urlmeta-json-error',
            message: error?.message || String(error),
          })
        }
        next()
      })
      return
    }

    if (relPath === 'items-meta.json') {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        try {
          result.itemsMeta = JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}
        } catch (error) {
          result.warnings.push({
            code: 'items-meta-json-error',
            message: error?.message || String(error),
          })
        }
        next()
      })
      return
    }

    if (relPath === 'all-images.json') {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        try {
          result.allImages = JSON.parse(Buffer.concat(chunks).toString('utf8')) || []
        } catch (error) {
          result.warnings.push({
            code: 'all-images-json-error',
            message: error?.message || String(error),
          })
        }
        next()
      })
      return
    }

    if (relPath === 'all-products.json') {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        try {
          result.allProducts = JSON.parse(Buffer.concat(chunks).toString('utf8')) || []
        } catch (error) {
          result.warnings.push({
            code: 'all-products-json-error',
            message: error?.message || String(error),
          })
        }
        next()
      })
      return
    }

    if (relPath === 'runs-history.json') {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        try {
          result.runsHistory = JSON.parse(Buffer.concat(chunks).toString('utf8')) || []
        } catch (error) {
          result.warnings.push({
            code: 'runs-history-json-error',
            message: error?.message || String(error),
          })
        }
        next()
      })
      return
    }

    if (relPath.startsWith('cache/robots/') && ext === '.txt') {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        const host = path.basename(relPath, '.txt')
        result.robotsTxt.set(host, {
          host,
          relPath,
          text: Buffer.concat(chunks).toString('utf8'),
          sizeBytes: header.size || 0,
        })
        next()
      })
      return
    }

    if (relPath.startsWith('cache/robots/') && ext === '.json') {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        const host = path.basename(relPath, '.json')
        try {
          result.robotsDecoded.set(host, JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch {}
        next()
      })
      return
    }

    if (relPath.startsWith('items/') && ext === '.ndjson') {
      stats.ndjson.count++
      stats.ndjson.totalBytes += header.size || 0
      const shardInfo = {
        name: relPath,
        sizeBytes: header.size || 0,
        mtimeISO: header.mtime ? new Date(header.mtime * 1000).toISOString() : null,
      }
      stats.ndjson.shards.push(shardInfo)
      if ((header.mtime || 0) > stats.ndjson.latestMtime) {
        stats.ndjson.latestMtime = header.mtime || 0
        stats.ndjson.latestShard = relPath
      }

      let leftover = ''
      stream.on('data', (chunk) => {
        if (result.samples.length >= sampleLimit) return
        leftover += chunk.toString('utf8')
        let index
        while (result.samples.length < sampleLimit && (index = leftover.indexOf('\n')) !== -1) {
          const line = leftover.slice(0, index)
          leftover = leftover.slice(index + 1)
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            result.samples.push(JSON.parse(trimmed))
          } catch {}
        }
      })
      stream.on('end', () => {
        if (result.samples.length < sampleLimit) {
          const trimmed = leftover.trim()
          if (trimmed) {
            try {
              result.samples.push(JSON.parse(trimmed))
            } catch {}
          }
        }
        next()
      })
      return
    }

    if (
      relPath.startsWith('cache/') && !relPath.startsWith('cache/robots/')
      && /\.(xml|txt|gz)$/i.test(relPath)
    ) {
      const previewChunks = []
      let captured = 0
      stream.on('data', (chunk) => {
        if (captured < previewLimit) {
          const slice = chunk.subarray(
            0,
            Math.max(0, Math.min(chunk.length, previewLimit - captured)),
          )
          if (slice.length) previewChunks.push(slice)
          captured += slice.length
        }
      })
      stream.on('end', () => {
        const host = hostFromCachePath(relPath)
        result.docs.set(relPath, {
          relPath,
          host,
          preview: Buffer.concat(previewChunks).toString('utf8'),
          sizeBytes: header.size || 0,
        })
        next()
      })
      return
    }

    stream.resume()
    stream.on('end', next)
  })

  await pipeline(createReadStream(info.path), createGunzip(), extract)

  stats.directories = Array.from(stats.directories)
  stats.locales = Array.from(stats.locales)
  stats.ndjson.shards.sort((a, b) => (b.mtimeISO || '').localeCompare(a.mtimeISO || ''))

  return {
    ok: true,
    path: info.path,
    stats,
    archive: { sizeBytes: info.sizeBytes, sha256: info.sha256, mtimeMs: info.mtimeMs },
    dataset: result,
    warnings: result.warnings,
  }
}

export function normalizeUrlmetaMap(urlmeta = {}) {
  const reverse = new Map()
  for (const [url, meta] of Object.entries(urlmeta)) {
    if (!meta || !meta.path) continue
    const rel = toDatasetPath(meta.path)
    if (!rel) continue
    reverse.set(rel, { url, status: meta.status ?? '', contentType: meta.contentType || '' })
  }
  return reverse
}

export function collectRobotsEntries(raw) {
  const allHosts = new Set()
  for (const key of raw.robotsTxt.keys()) allHosts.add(key)
  for (const key of raw.robotsDecoded.keys()) allHosts.add(key)
  return Array.from(allHosts).sort().map((host) => ({
    host,
    text: raw.robotsTxt.get(host)?.text || '',
    relPath: raw.robotsTxt.get(host)?.relPath || '',
    sizeBytes: raw.robotsTxt.get(host)?.sizeBytes || 0,
    decoded: raw.robotsDecoded.get(host) || null,
  }))
}

export function buildDocsArray(rawDocs, reverseMeta) {
  const docs = []
  for (const doc of rawDocs.values()) {
    const meta = reverseMeta.get(doc.relPath) || {}
    docs.push({
      ...doc,
      url: meta.url || '',
      status: meta.status || '',
      contentType: meta.contentType || '',
    })
  }
  return docs
}
