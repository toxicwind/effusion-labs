import { contentArea } from '../../lib/content-area.mjs'

const base = contentArea('work')

const take = (arr, count) =>
  Array.isArray(arr) && Number.isFinite(count) ? arr.slice(0, Math.max(count, 0)) : []

export default {
  ...base,
  eleventyComputed: {
    ...base.eleventyComputed,
    work: data => take(data.collections?.work, 12),
  },
}
