// Redirect: /work/drop → newest item with type "drop"
export const data = {
  permalink: '/work/drop/index.html',
  eleventyComputed: {
    outboundLinks: () => [],
    redirect: data => {
      const items = Array.isArray(data.collections?.work)
        ? data.collections.work
        : []
      const drops = [...items]
        .filter(item => (item?.data?.type || '').toLowerCase() === 'drop')
        .sort(
          (a, b) => (b?.date?.valueOf?.() ?? 0) - (a?.date?.valueOf?.() ?? 0)
        )
      return drops[0]?.url ?? '/work/'
    },
  },
  eleventyExcludeFromCollections: true,
}

export const render = data => {
  const to = data?.redirect ?? '/work/'
  return `<p>Redirecting to <a href="${to}">${to}</a>…</p>`
}
