// lib/interlinkers/route-registry.mjs
// Central registry of linkable kinds and how to index/resolve them.

export const routeRegistry = {
  // Locale handling
  defaultLocale: 'en',
  localePrefixEnabled: false, // when true, prefix hrefs with /:locale/

  // If a wikilink omits kind (e.g., [[labubu]]), check kinds in order
  defaultKindsPriority: ['work', 'character', 'product', 'series', 'concept', 'project', 'spark', 'meta'],

  // Kind definitions
  kinds: {
    // Archives — canonical dynamic routes
    product: {
      basePath: '/archives/product',
      // Where to find items from current page context
      datasetKeys: ['archiveProductsEn', 'archiveAllProducts', 'archiveProducts'],
      keyFields: ['slugCanonical', 'productSlug', 'slug', 'product_id', 'title'],
      canonicalFromData: (d) => `/archives/product/${d.slugCanonical || d.productSlug || d.slug}/`,
      aliasesFromData: (d) => [
        ...(Array.isArray(d.slugAliases) ? d.slugAliases : []),
        ...(Array.isArray(d.legacyPaths) ? d.legacyPaths.map((p) => (typeof p === 'string' ? (p.match(/\/archives\/product\/([^/]+)/)?.[1] || null) : null)).filter(Boolean) : []),
      ],
    },
    character: {
      basePath: '/archives/character',
      datasetKeys: ['archiveCharactersEn', 'archiveAllCharacters', 'archiveCharacters'],
      keyFields: ['charSlug', 'name', 'title', 'slug'],
      canonicalFromData: (d) => `/archives/character/${d.charSlug || d.slug}/`,
      aliasesFromData: () => [],
    },
    series: {
      basePath: '/archives/series',
      datasetKeys: ['archiveSeriesEn', 'archiveAllSeries', 'archiveSeries'],
      keyFields: ['seriesSlug', 'title', 'slug'],
      canonicalFromData: (d) => `/archives/series/${d.seriesSlug || d.slug}/`,
      aliasesFromData: () => [],
    },

    // First-class content scaffolds
    spark: {
      basePath: '/sparks',
      datasetKeys: ['collections.sparks'],
      keyFields: ['fileSlug', 'data.title'],
      canonicalFromData: (d) => `/sparks/${d.fileSlug || d.slug || ''}/`,
      aliasesFromData: (d) => Array.isArray(d?.data?.aliases) ? d.data.aliases : [],
    },
    concept: {
      basePath: '/concepts',
      datasetKeys: ['collections.concepts'],
      keyFields: ['fileSlug', 'data.title'],
      canonicalFromData: (d) => `/concepts/${d.fileSlug || d.slug || ''}/`,
      aliasesFromData: (d) => Array.isArray(d?.data?.aliases) ? d.data.aliases : [],
    },
    project: {
      basePath: '/projects',
      datasetKeys: ['collections.projects'],
      keyFields: ['fileSlug', 'data.title'],
      canonicalFromData: (d) => `/projects/${d.fileSlug || d.slug || ''}/`,
      aliasesFromData: (d) => Array.isArray(d?.data?.aliases) ? d.data.aliases : [],
    },
    meta: {
      basePath: '/meta',
      datasetKeys: ['collections.meta'],
      keyFields: ['fileSlug', 'data.title'],
      canonicalFromData: (d) => `/meta/${d.fileSlug || d.slug || ''}/`,
      aliasesFromData: (d) => Array.isArray(d?.data?.aliases) ? d.data.aliases : [],
    },
    // Work: aggregator over content areas
    work: {
      basePath: '/work',
      datasetKeys: ['collections.work', 'collections.sparks', 'collections.concepts', 'collections.projects', 'collections.meta'],
      keyFields: ['fileSlug', 'data.title'],
      canonicalFromData: (d) => d?.url || `/${d?.data?.type || 'work'}/${d?.fileSlug || ''}/`,
      aliasesFromData: (d) => Array.isArray(d?.data?.aliases) ? d.data.aliases : [],
    },
  },
};

// Helper to read a nested key like 'collections.work'
export function getByPath(obj, key) {
  if (!obj || !key) return undefined;
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return undefined;
  }
  return cur;
}

