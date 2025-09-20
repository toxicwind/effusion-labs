import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { XMLParser } from 'fast-xml-parser'
import pLimit from 'p-limit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedDir = path.join(__dirname, 'generated')
const datasetPath = path.join(generatedDir, 'images.json')

const SUBDOMAINS = [
  'us',
  'fr',
  'es',
  'hk',
  'in',
  'eu',
  'en',
  'de',
  'it',
  'ca',
  'au',
  'jp',
  'kr',
  'br',
  'sg',
]

const LOCALES = [
  'eng_US',
  'fra_FR',
  'esp_ES',
  'eng_GB',
  'eng_HK',
  'eng_AU',
  'eng_CA',
  'eng_E1',
  'deu_DE',
  'ita_IT',
  'jpn_JP',
  'kor_KR',
  'por_BR',
  'eng_IN',
  'eng_SG',
  'rus_RU',
]

const SITEMAP_URLS = SUBDOMAINS.flatMap(sub =>
  LOCALES.map(locale =>
    `https://${sub}.louisvuitton.com/content/louisvuitton/sitemap/${locale}/sitemap-image.xml`
  )
)

const USER_AGENT = 'LV-Image-Atlas/2.0 (+https://effusionlabs.com)'
const CONCURRENCY = 6

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
  allowBooleanAttributes: true,
})

function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function localeOf(url) {
  try {
    const match = new URL(url).pathname.match(/\/sitemap\/([^/]+)\/sitemap-image\.xml$/i)
    return match ? match[1] : ''
  } catch {
    return ''
  }
}

async function fetchXml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
  })
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status})`)
  }
  return await res.text()
}

function parseSitemap(xmlText) {
  const root = parser.parse(xmlText)
  const urlset = root.urlset || root.sitemapindex || root
  const urls = Array.isArray(urlset.url) ? urlset.url : urlset.url ? [urlset.url] : []
  const items = []
  for (const entry of urls) {
    const pageUrl = entry?.loc || ''
    let images = entry?.image || entry?.['image:image'] || []
    if (!Array.isArray(images)) images = [images]
    for (const image of images) {
      if (!image) continue
      const src = image.loc || image['image:loc'] || image.url || null
      if (!src) continue
      const title = image.title || image['image:title'] || image.caption || image['image:caption']
        || ''
      const license = image.license || image['image:license'] || ''
      items.push({ src, title, license, pageUrl })
    }
  }
  return items
}

function makeId(src, page) {
  const hash = createHash('sha1')
  hash.update(String(src || ''))
  hash.update('|')
  hash.update(String(page || ''))
  return hash.digest('hex').slice(0, 16)
}

function sortEntries(a, b) {
  if (a.locale !== b.locale) return a.locale.localeCompare(b.locale)
  if (a.host !== b.host) return a.host.localeCompare(b.host)
  return a.src.localeCompare(b.src)
}

function sortSitemaps(a, b) {
  if (a.locale !== b.locale) return a.locale.localeCompare(b.locale)
  if (a.host !== b.host) return a.host.localeCompare(b.host)
  return a.url.localeCompare(b.url)
}

function aggregateCounts(entries) {
  const pages = new Set()
  const localeCounts = new Map()
  const hostCounts = new Map()

  for (const item of entries) {
    if (item.page) pages.add(item.page)
    if (item.locale) localeCounts.set(item.locale, (localeCounts.get(item.locale) || 0) + 1)
    if (item.host) hostCounts.set(item.host, (hostCounts.get(item.host) || 0) + 1)
  }

  const toObject = map =>
    Object.fromEntries(
      Array.from(map.entries()).sort((a, b) => {
        if (b[1] === a[1]) return a[0].localeCompare(b[0])
        return b[1] - a[1]
      }),
    )

  return {
    images: entries.length,
    pages: pages.size,
    locales: toObject(localeCounts),
    hosts: toObject(hostCounts),
  }
}

async function main() {
  console.log(`Fetching ${SITEMAP_URLS.length} image sitemaps…`)
  await mkdir(generatedDir, { recursive: true })

  const limit = pLimit(CONCURRENCY)
  const items = []
  const sitemaps = []
  const failures = []

  await Promise.all(
    SITEMAP_URLS.map(url =>
      limit(async () => {
        const meta = { url, host: hostOf(url), locale: localeOf(url) }
        try {
          const xml = await fetchXml(url)
          const rawEntries = parseSitemap(xml)
          const entries = rawEntries.map((entry, index) => ({
            id: makeId(entry.src, entry.pageUrl),
            src: entry.src,
            title: entry.title || '',
            license: entry.license || '',
            page: entry.pageUrl || '',
            locale: meta.locale,
            host: meta.host,
            sitemap: meta.url,
            position: index,
          }))
          items.push(...entries)
          sitemaps.push({ ...meta, ok: true, imageCount: entries.length })
          console.log(`✓ ${url}  +${entries.length} images`)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          sitemaps.push({ ...meta, ok: false, imageCount: 0, error: message })
          failures.push({ ...meta, error: message })
          console.warn(`✗ ${url}  ${message}`)
        }
      })
    ),
  )

  items.sort(sortEntries)
  sitemaps.sort(sortSitemaps)

  const totals = aggregateCounts(items)
  const dataset = {
    version: 1,
    generatedAt: new Date().toISOString(),
    config: {
      subdomains: SUBDOMAINS,
      locales: LOCALES,
      concurrency: CONCURRENCY,
    },
    totals: {
      ...totals,
      sitemaps: sitemaps.length,
      ok: sitemaps.filter(s => s.ok).length,
      failures: failures.length,
    },
    sitemaps,
    failures,
    items,
  }

  await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
  console.log(`\nSaved dataset → ${path.relative(process.cwd(), datasetPath)}`)
  console.log(
    `Images: ${dataset.totals.images.toLocaleString()}, unique pages: ${dataset.totals.pages.toLocaleString()}`,
  )
  if (failures.length) {
    console.warn(`Failures: ${failures.length}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
