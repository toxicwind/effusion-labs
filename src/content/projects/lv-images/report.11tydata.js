import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(here, '../../../..')
const lvreportModuleUrl = pathToFileURL(path.join(projectRoot, '_data', 'lvreport.js')).href

let memoizedReport = null

async function loadReport() {
  if (memoizedReport) return memoizedReport
  const module = await import(lvreportModuleUrl)
  if (typeof module.default !== 'function') {
    throw new Error('lvreport data module missing default export')
  }
  const report = await module.default()
  memoizedReport = report
  return report
}

export default async function() {
  const report = await loadReport()
  const pages = report?.pages
  if (!Array.isArray(pages) || pages.length === 0) {
    const reason = report?.__lvreportFallbackReason || 'missing lvreport.pages'
    const detail = Array.isArray(pages) ? `length=${pages.length}` : typeof pages
    throw new Error(`lvreport pagination unavailable (${reason}, pages:${detail})`)
  }

  return {
    lvreport: report,
    lvreportPages: pages,
    pagination: {
      data: 'lvreportPages',
      size: 1,
      alias: 'lvReportPage',
    },
    eleventyComputed: {
      permalink(context) {
        const pageNumber = context.pagination?.pageNumber ?? 0
        return pageNumber === 0 ? '/lv/report/' : `/lv/report/page/${pageNumber + 1}/`
      },
      title(context) {
        const base = 'LV Image Atlas — Report'
        const pageNumber = context.lvReportPage?.pageNumber ?? 0
        const total = context.lvReportPage?.pageCount ?? 1
        return pageNumber === 0 ? base : `${base} (Page ${pageNumber + 1} of ${total})`
      },
      clientPayloadJson(context) {
        const payload = {
          baseHref: context.lvreport?.baseHref || '/content/projects/lv-images/generated/lv/',
          totals: context.lvreport?.totals || {},
          dataset: {
            ndjson: context.lvreport?.dataset?.ndjson || {},
            cache: context.lvreport?.dataset?.cache || {},
            warnings: context.lvreport?.dataset?.warnings || [],
            history: context.lvreport?.dataset?.history || null,
            flags: context.lvreport?.dataset?.flags || [],
            capture: context.lvreport?.dataset?.capture || [],
            summaryTotals: context.lvreport?.dataset?.summaryTotals || null,
            bundleLabel: context.lvreport?.dataset?.bundleLabel || null,
            runMode: context.lvreport?.dataset?.runMode || null,
          },
          page: {
            number: context.lvReportPage?.pageNumber ?? 0,
            count: context.lvReportPage?.pageCount ?? 1,
            sections: context.lvReportPage?.sections || {},
          },
          search: context.lvreport?.search || {},
        }
        return JSON.stringify(payload)
          .replace(/</g, '\\u003c')
          .replace(/>/g, '\\u003e')
          .replace(/&/g, '\\u0026')
          .replace(/\u2028/g, '\\u2028')
          .replace(/\u2029/g, '\\u2029')
      },
    },
  }
}
