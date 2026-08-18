import crypto from 'node:crypto'
import fs from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import EleventyFetch from '@11ty/eleventy-fetch'
import { LRUCache } from 'lru-cache'

const projectRoot = process.cwd()
const cacheRoot = path.join(projectRoot, '.cache')
const imageCacheDir = path.join(cacheRoot, 'lv-images')
const logFile = path.join(cacheRoot, 'remote-assets.log')

const placeholderPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/Pi3TfQAAAABJRU5ErkJggg==',
  'base64',
)

const pending = new Map()
const logged = new Set()
const memoryCache = new LRUCache({ max: 500, ttl: 1000 * 60 * 60 })

async function ensureCacheDirs() {
  await mkdir(imageCacheDir, { recursive: true })
}

function decodeExt(url) {
  try {
    const { pathname } = new URL(url)
    const decoded = decodeURIComponent(pathname)
    const ext = path.extname(decoded)
    if (ext && ext.length <= 6) {
      return ext
    }
  } catch {}
  return '.bin'
}

async function fileExists(filePath) {
  return new Promise(resolve => {
    fs.access(filePath, fs.constants.F_OK, err => {
      resolve(!err)
    })
  })
}

async function appendLog(url) {
  if (logged.has(url)) return
  logged.add(url)
  try {
    await mkdir(cacheRoot, { recursive: true })
    await fs.promises.appendFile(logFile, `${url}\n`, 'utf8')
  } catch {}
}

async function writePlaceholder(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, placeholderPng)
}

async function fetchAndCache(url, filePath) {
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EffusionLabsBot/1.0',
    accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    referer: 'https://www.louisvuitton.com/',
  }

  try {
    const buffer = await EleventyFetch(url, {
      directory: imageCacheDir,
      duration: '30d',
      type: 'buffer',
      fetchOptions: { headers },
    })
    await writeFile(filePath, buffer)
    console.log(`[cache] Stored remote asset ${url} -> ${filePath}`)
  } catch (error) {
    if (!await fileExists(filePath)) {
      await writePlaceholder(filePath)
    }
    console.warn(`[cache] Failed to fetch ${url}: ${error?.message || error}`)
  }
}

export function cacheRemoteImage(url) {
  if (!url) return Promise.resolve(null)
  if (memoryCache.has(url)) {
    return Promise.resolve(memoryCache.get(url))
  }
  if (pending.has(url)) {
    return pending.get(url)
  }

  const job = (async () => {
    await ensureCacheDirs()
    const ext = decodeExt(url)
    const hash = crypto.createHash('sha1').update(url).digest('hex')
    const filePath = path.join(imageCacheDir, `${hash}${ext}`)

    if (await fileExists(filePath)) {
      await appendLog(url)
      memoryCache.set(url, filePath)
      return filePath
    }

    if (process.env.BUILD_OFFLINE === '1') {
      await writePlaceholder(filePath)
    } else {
      await fetchAndCache(url, filePath)
    }

    await appendLog(url)
    memoryCache.set(url, filePath)
    return filePath
  })().finally(() => {
    pending.delete(url)
  })

  pending.set(url, job)
  return job
}

export default { cacheRemoteImage }
