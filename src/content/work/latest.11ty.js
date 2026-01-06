// Redirect: /work/latest → newest work item (any type)
export const data = {
  layout: 'redirect.njk',
  permalink: '/work/latest/',
  eleventyComputed: {
    outboundLinks: () => [],
    redirect: data => {
      const items = Array.isArray(data.collections?.work)
        ? data.collections.work
        : []
      const sorted = [...items].sort(
        (a, b) => (b?.date?.valueOf?.() ?? 0) - (a?.date?.valueOf?.() ?? 0),
      )
      const target = sorted[0]?.url ?? '/work/'
      if (typeof target !== 'string') {
        return '/work/'
      }
      if (target.endsWith('/')) {
        return `${target}index.html`
      }
      return target
    },
  },
  eleventyExcludeFromCollections: true,
}

export const render = data => {
  const to = data?.redirect ?? '/work/'
  return `<p>Redirecting to <a href="${to}">${to}</a>…</p>`
}
