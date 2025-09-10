/**
 * Emits HTML stub pages (one per legacy/alias path) with meta refresh to the
 * canonical URL. These are excluded from sitemap.
 */
export default class {
  data() {
    const on = (process.env.ARCHIVE_CANON_ROUTES ?? 'true') !== 'false';
    if (!on) return { pagination: { size: 0 } };
    return {
      pagination: {
        data: 'archiveProductMap',
        size: 1,
        alias: 'entry',
        before: (items) => {
          const seen = new Map();
          for (const it of items || []) {
            const target = it.canonicalUrl;
            // Stubs only for deep legacy paths to avoid collisions with canonical or other alias slugs
            const set = new Set([...(it.legacyPaths || []).filter(p => p.includes('/collectables/'))]);
            for (const from of set) {
              if (!from || from === target) continue;
              if (!seen.has(from)) seen.set(from, target);
            }
          }
          return Array.from(seen.entries()).map(([from, target]) => ({ from, target }));
        },
      },
      permalink: (data) => data.entry.from,
      sitemap: { ignore: true },
      eleventyExcludeFromCollections: true,
      layout: false,
    };
  }

  render(data) {
    const target = data.entry.target;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="${target}">
  <title>Redirecting…</title>
</head>
<body>
  <p>Redirecting to canonical page: <a href="${target}">${target}</a></p>
</body>
</html>`;
  }
}
