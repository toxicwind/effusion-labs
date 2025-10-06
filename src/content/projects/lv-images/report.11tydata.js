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

  return {
    lvreport: report,
    eleventyComputed: {
      permalink() {
        return '/lv/report/'
      },
      title() {
        return 'LV Image Atlas — Report'
      },
      clientPayloadJson(context) {
        const payload = {
          baseHref: context.lvreport?.baseHref || '/content/projects/lv-images/generated/lv/',
          totals: context.lvreport?.totals || {},
          navigation: context.lvreport?.navigation || [],
          gallery: {
            pageSize: context.lvreport?.gallery?.pageSize ?? 0,
            pageCount: context.lvreport?.gallery?.pageCount ?? 0,
            totalItems: context.lvreport?.gallery?.totalItems ?? 0,
            datasetHref: context.lvreport?.gallery?.datasetHref || '',
            preview: context.lvreport?.gallery?.preview || { items: [] },
            hosts: context.lvreport?.gallery?.hosts || [],
            dateBuckets: context.lvreport?.gallery?.dateBuckets || [],
            pageSizes: context.lvreport?.gallery?.pageSizes || [],
          },
          highlights: context.lvreport?.highlights || {},
          duplicates: { summary: context.lvreport?.duplicates?.summary || {} },
          pagesReport: { total: context.lvreport?.pagesReport?.total ?? 0 },
          metrics: context.lvreport?.metrics || {},
          dataset: context.lvreport?.dataset || {},
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
