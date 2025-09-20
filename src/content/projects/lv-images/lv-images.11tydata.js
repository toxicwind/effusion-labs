import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const datasetPath = path.join(__dirname, 'generated', 'images.json')

const FALLBACK_TOTALS = {
  images: 0,
  pages: 0,
  sitemaps: 0,
  ok: 0,
  failures: 0,
  locales: {},
  hosts: {},
}

const fmt = new Intl.NumberFormat('en-US')

const asList = (obj, limit = 12) =>
  Object.entries(obj || {})
    .sort((a, b) => {
      if (b[1] === a[1]) return a[0].localeCompare(b[0])
      return b[1] - a[1]
    })
    .slice(0, limit)
    .map(([key, count]) => ({ key, count, display: fmt.format(count) }))

async function readDataset() {
  try {
    const raw = await readFile(datasetPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('[lv-images] Unable to load dataset:', error.message || error)
    }
    return null
  }
}

export default async function data() {
  const dataset = await readDataset()
  const totals = dataset?.totals || FALLBACK_TOTALS

  const topLocales = asList(totals.locales)
  const topHosts = asList(totals.hosts)

  const totalsFormatted = {
    images: fmt.format(totals.images || 0),
    pages: fmt.format(totals.pages || 0),
    sitemaps: fmt.format(totals.sitemaps || 0),
    ok: fmt.format(totals.ok || 0),
    failures: fmt.format(totals.failures || 0),
    localeCount: fmt.format(Object.keys(totals.locales || {}).length),
    hostCount: fmt.format(Object.keys(totals.hosts || {}).length),
  }

  const datasetMeta = dataset
    ? {
      version: dataset.version,
      generatedAt: dataset.generatedAt,
      totals,
      sitemaps: dataset.sitemaps,
      failures: dataset.failures,
    }
    : null

  return {
    layout: 'project.njk',
    title: 'Louis Vuitton Image Atlas',
    permalink: '/projects/lv-images/',
    projectSlug: 'lv-images',
    eleventyExcludeFromCollections: false,
    datasetAvailable: Boolean(dataset),
    dataJsonUrl: dataset ? '/projects/lv-images/images.json' : null,
    datasetMeta,
    totalsFormatted,
    topLocales,
    topHosts,
  }
}
