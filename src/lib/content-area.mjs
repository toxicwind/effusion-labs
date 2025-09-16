export function contentArea(name) {
  return {
    tags: [name],
    eleventyComputed: {
      permalink: data => {
        if (data.permalink) return data.permalink
        if (data.page.fileSlug === 'index' || data.page.fileSlug === '_index') {
          return `/${name}/`
        }
        return `/${name}/${data.page.fileSlug}/`
      },
      layout: data => data.layout ?? 'layouts/base.njk',
    },
  }
}

export default contentArea
