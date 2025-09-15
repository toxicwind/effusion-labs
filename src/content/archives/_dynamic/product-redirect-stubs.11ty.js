/**
 * Emits HTML stub pages (one per legacy/alias path) that use your base layout
 * and inject a meta refresh + canonical to the product’s canonical URL.
 * Excluded from sitemap and collections.
 */
export default class {
  data() {
    const on = (process.env.ARCHIVE_CANON_ROUTES ?? 'true') !== 'false'
    if (!on) return { pagination: { size: 0 } }

    return {
      layout: 'layouts/base.njk',
      pagination: {
        data: 'archiveProductMap',
        size: 1,
        alias: 'entry',
        before: items => {
          const seen = new Map()
          for (const it of items || []) {
            const target = it.canonicalUrl
            const set = new Set([
              ...(it.legacyPaths || []).filter(p =>
                p.includes('/collectables/')
              ),
            ])
            for (const from of set) {
              if (!from || from === target) continue
              if (!seen.has(from)) seen.set(from, target)
            }
          }
          return Array.from(seen.entries()).map(([from, target]) => ({
            from,
            target,
          }))
        },
      },
      permalink: data => data.entry.from,
      sitemap: { ignore: true },
      eleventyExcludeFromCollections: true,
      eleventyComputed: {
        title: () => 'Redirecting…',
        // Inject into <head> via base.njk’s {{ headExtra | safe }}
        headExtra: data =>
          data.entry?.target
            ? `<meta http-equiv="refresh" content="0; url=${data.entry.target}">
               <link rel="canonical" href="${data.entry.target}">
               <meta name="robots" content="noindex,follow">`
            : '',
        showTitle: () => false,
        metaDisable: () => true,
      },
    }
  }

  render(data) {
    const target = data.entry?.target || '/archives/'
    return `
<p>Redirecting to canonical page:
  <a class="link link-hover" href="${target}">${target}</a>
</p>
<script>try{location.replace(${JSON.stringify(target)});}catch(_){};</script>
`.trim()
  }
}
