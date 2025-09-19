import fs from 'node:fs'

export const data = () => ({
  eleventyExcludeFromCollections: true,
  pagination: { data: 'collections.jsonlProvenance', size: 1, alias: 'entry' },
  eleventyComputed: {
    permalink: ({ entry }) =>
      entry
        ? `/archives/${entry.industry}/${entry.category}/${entry.company}/${entry.line}/provenance/${entry.slug}.jsonl`
        : false,
  },
})

export const render = ({ entry }) => {
  if (!entry) return ''
  // Keep raw JSONL output (no layout) so users can save the file directly.
  return fs.readFileSync(entry.abs, 'utf8')
}
