import { contentArea } from '../../../config/content-area.js'

const base = contentArea('work')

export default {
  ...base,
  eleventyComputed: {
    ...base.eleventyComputed,
    work: data => data.collections.work,
  },
}
