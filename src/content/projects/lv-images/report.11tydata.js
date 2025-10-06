import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(here, '../../../..')
const lvreportModuleUrl = pathToFileURL(path.join(projectRoot, 'src', '_data', 'lvreport.js')).href

let memoized = null

async function loadReportModule() {
  if (!memoized) {
    const module = await import(lvreportModuleUrl)
    if (typeof module.default !== 'function') {
      throw new Error('lvreport data module missing default export')
    }
    memoized = module
  }
  return memoized
}

function sanitizeForInline(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export default async function() {
  const module = await loadReportModule()
  const report = await module.default()
  const clientPayload = report?.clientPayload
    || (typeof module.loadClientPayload === 'function' ? await module.loadClientPayload() : null)

  const payload = clientPayload || {
    indexHref: '/assets/data/lvreport/index.json',
    metaHref: '/assets/data/lvreport/meta.json',
    metricsHref: '/assets/data/lvreport/ingest-metrics.json',
    searchHref: '/assets/data/lvreport/search-index.json',
    facets: report?.facets || {},
    totals: report?.totals || {},
    kpis: report?.kpis || [],
  }

  return {
    lvreport: report,
    eleventyComputed: {
      permalink: () => '/lv/report/',
      title: () => 'LV Image Atlas — Report',
      clientPayloadJson: () => sanitizeForInline(payload),
    },
  }
}
