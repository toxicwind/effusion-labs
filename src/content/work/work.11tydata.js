import { contentArea } from '../../lib/content-area.mjs'

const base = contentArea('work')

export default {
  ...base,
  eleventyComputed: {
    ...base.eleventyComputed,
    work: data => data.collections.work,
  },
}
