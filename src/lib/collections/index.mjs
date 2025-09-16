// src/lib/collections/index.mjs
export function registerCollections(eleventyConfig) {
  eleventyConfig.addCollection('featured', api =>
    api
      .getAll()
      .filter(p => p.data?.featured === true)
      .sort((a, b) => b.date - a.date)
  )

  eleventyConfig.addCollection('interactive', api =>
    api
      .getAll()
      .filter(p => {
        const tags = p.data.tags || []
        return tags.includes('prototype') || p.data.interactive === true
      })
      .sort((a, b) => b.date - a.date)
  )

  eleventyConfig.addCollection('work', api =>
    ['projects', 'concepts', 'sparks', 'meta']
      .flatMap(tag => api.getFilteredByTag(tag))
      .sort((a, b) => b.date - a.date)
  )

  eleventyConfig.addCollection('recentAll', api => {
    const items = api.getAll().filter(p => p.data.type)
    items.sort((a, b) => b.date - a.date)
    items.take = n => items.slice(0, n)
    return items
  })
}

export default { registerCollections }
