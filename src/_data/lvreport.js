import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MiniSearch from 'minisearch'

import { buildIndex, ensureBundleAvailable } from '../../tools/lv-images/index-builder.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const PUBLIC_DATA_DIR = path.join(projectRoot, '.cache', 'lv-images')
const DATASET_FILE = path.join(PUBLIC_DATA_DIR, 'lvreport.dataset.json')
const SEARCH_INDEX_FILE = path.join(PUBLIC_DATA_DIR, 'lvreport.search-index.json')
const CLIENT_PAYLOAD_FILE = path.join(PUBLIC_DATA_DIR, 'lvreport.client.json')

let memoized = null

export const DATASET_REPORT_FILE = DATASET_FILE

function toKpis(meta) {
  const totals = meta?.totals || {}
  return [
    {
      id: 'images',
      label: 'Images discovered',
      value: totals.images || totals.items || 0,
    },
    {
      id: 'products',
      label: 'Products mapped',
      value: totals.products || 0,
    },
    {
      id: 'hosts',
      label: 'Hosts tracked',
      value: totals.summaryHosts || totals.hosts || 0,
    },
    {
      id: 'documents',
      label: 'Cached documents',
      value: totals.documents || 0,
    },
  ]
}

function buildSearchIndex(rows) {
  const engine = new MiniSearch({
    fields: ['title', 'sku', 'locale', 'productType', 'tags'],
    storeFields: ['id', 'title', 'sku', 'locale', 'productType', 'pageUrl', 'imageUrl', 'hasHero', 'imageCount', 'updatedAt'],
    searchOptions: {
      boost: { title: 2, sku: 2 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
  const documents = rows.map((row) => ({
    id: row.id,
    title: row.title || row.pageUrl || row.sku || 'Untitled',
    sku: row.sku || '',
    locale: row.locale || 'unknown',
    productType: row.productType || 'other',
    pageUrl: row.pageUrl || '',
    imageUrl: row.imageUrl || '',
    hasHero: row.hasHero,
    imageCount: row.imageCount ?? 0,
    updatedAt: row.updatedAt || row.lastMod || '',
    tags: Array.isArray(row.tags) ? row.tags.join(' ') : '',
  }))
  engine.addAll(documents)
  return { engine, documents }
}

function buildSections(meta, rows) {
  const summary = meta?.summary || {}
  return {
    datasetMap: {
      hosts: summary?.hosts || [],
      locales: summary?.locales || [],
    },
    sitemaps: summary?.sitemaps || [],
    duplicates: meta?.images?.filter((img) => img?.duplicateOf).slice(0, 50) || [],
    topProducts: meta?.products?.slice(0, 50) || [],
    runsHistory: meta?.runsHistory || [],
    robots: meta?.robots || [],
    docs: meta?.docs || [],
    sample: Array.isArray(rows) ? rows.slice(0, 60) : [],
  }
}

async function writeClientPayload({
  indexHref,
  metaHref,
  metricsHref,
  searchHref,
  facets,
  totals,
  kpis,
}) {
  await mkdir(PUBLIC_DATA_DIR, { recursive: true })
  const payload = {
    indexHref,
    metaHref,
    metricsHref,
    searchHref,
    facets,
    totals,
    kpis,
  }
  await writeFile(CLIENT_PAYLOAD_FILE, `${JSON.stringify(payload)}\n`, 'utf8')
  return payload
}

async function buildReport() {
  await ensureBundleAvailable()
  const { meta, rows } = await buildIndex()
  const { engine, documents } = buildSearchIndex(rows)
  const searchIndex = engine.toJSON()
  const facets = meta?.facets || {}
  const totals = meta?.totals || {}
  const kpis = toKpis(meta)
  const sections = buildSections(meta, rows)

  await mkdir(PUBLIC_DATA_DIR, { recursive: true })
  await writeFile(DATASET_FILE, `${JSON.stringify({ meta, rows, sections })}\n`, 'utf8')
  await writeFile(SEARCH_INDEX_FILE, `${JSON.stringify({ documents, index: searchIndex })}\n`, 'utf8')
  const clientPayload = await writeClientPayload({
    indexHref: '/assets/data/lvreport/index.json',
    metaHref: '/assets/data/lvreport/meta.json',
    metricsHref: '/assets/data/lvreport/ingest-metrics.json',
    searchHref: '/assets/data/lvreport/search-index.json',
    facets,
    totals,
    kpis,
  })

  return {
    generatedAt: meta?.generatedAt || new Date().toISOString(),
    totals,
    facets,
    kpis,
    sections,
    meta,
    rows,
    search: {
      documents,
      index: searchIndex,
      count: documents.length,
    },
    clientPayload,
  }
}

export async function buildAndPersistReport({ log } = {}) {
  const report = await getReport()
  if (typeof log === 'function') {
    log(
      `lvreport dataset cached → ${path.relative(projectRoot, DATASET_FILE)} (items=${
        report?.search?.count ?? '?'
      })`,
    )
  }
  return { file: DATASET_FILE, payload: report }
}

async function getReport() {
  if (memoized) return memoized
  memoized = await buildReport()
  return memoized
}

export default async function() {
  return getReport()
}

export async function loadClientPayload() {
  try {
    const raw = await readFile(CLIENT_PAYLOAD_FILE, 'utf8')
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}
