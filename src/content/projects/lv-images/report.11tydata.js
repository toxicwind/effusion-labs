export default {
  pagination: {
    data: 'lvreport.pages',
    size: 1,
    alias: 'lvReportPage',
  },
  eleventyComputed: {
    permalink(data) {
      const pageNumber = data.pagination?.pageNumber ?? 0
      return pageNumber === 0 ? '/lv/report/' : `/lv/report/page/${pageNumber + 1}/`
    },
    title(data) {
      const base = 'LV Image Atlas — Report'
      const pageNumber = data.lvReportPage?.pageNumber ?? 0
      const total = data.lvReportPage?.pageCount ?? 1
      return pageNumber === 0 ? base : `${base} (Page ${pageNumber + 1} of ${total})`
    },
  },
}
