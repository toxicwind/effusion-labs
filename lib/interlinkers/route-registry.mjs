// lib/interlinkers/route-registry.mjs
// Central registry of linkable kinds and how to index/resolve them.

function _defaultRegistry() {
  return {
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
}

import fs from 'node:fs';
import path from 'node:path';

function _mergeFromDiscovery(reg) {
  try {
    const p = path.join('artifacts','reports','interlinker-discovery.json');
    if (!fs.existsSync(p)) return reg;
    const disc = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (disc?.i18n) {
      reg.defaultLocale = disc.i18n.defaultLocale || reg.defaultLocale;
      reg.localePrefixEnabled = !!disc.i18n.localePrefixes;
    }
    if (Array.isArray(disc?.scaffoldMap)) {
      const order = disc.scaffoldMap.map(k => k.kind);
      if (order.length) reg.defaultKindsPriority = order;
      for (const k of disc.scaffoldMap) {
        if (reg.kinds[k.kind]) {
          reg.kinds[k.kind].datasetKeys = Array.isArray(k.datasetKeys) && k.datasetKeys.length ? k.datasetKeys : reg.kinds[k.kind].datasetKeys;
          reg.kinds[k.kind].basePath = k.base || reg.kinds[k.kind].basePath;
        } else {
          // Generic kind using discovery base/datasets; shallow semantics
          reg.kinds[k.kind] = {
            basePath: `/${k.base?.replace(/^\//,'') || k.kind}`,
            datasetKeys: Array.isArray(k.datasetKeys) ? k.datasetKeys : [],
            keyFields: Array.isArray(k.keyFields) ? k.keyFields : ['slug','fileSlug','title'],
            canonicalFromData: (d) => `${`/${k.base?.replace(/^\//,'') || k.kind}`}/${d.slug || d.fileSlug || ''}/`,
            aliasesFromData: (d) => Array.isArray(d?.slugAliases) ? d.slugAliases : [],
          };
        }
      }
    }
  } catch {}
  return reg;
}

// Initialize registry and attempt to hydrate from discovery artifact if present
export const routeRegistry = _mergeFromDiscovery(_defaultRegistry());

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
