// lib/interlinkers/archives-resolvers.mjs
// Custom resolvers that let wikilinks target dynamic Eleventy pages produced
// by lib/eleventy/archives.mjs. Usage examples in Markdown:
//   [[series:lets-checkmate]]
//   [[character:labubu|Labubu character]]
//   [[product:lab010]] or [[product:LAB010]]

const slug = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const escapeHtml = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function findIn(list, target, fields) {
  if (!Array.isArray(list) || !list.length) return undefined;
  const want = slug(target);
  for (const item of list) {
    const d = item?.data ?? {};
    for (const f of fields) {
      const v = d[f];
      if (v && slug(v) === want) return item;
    }
  }
  return undefined;
}

function makeResolver(type, getList, fields, pickLabel) {
  return (link, currentPage /*, interlinker */) => {
    try {
      const list = getList(currentPage?.data ?? {});
      const item = findIn(list, link.name, fields);
      if (!item) {
        const raw = escapeHtml(link.title || link.name);
        return `<a class="interlink interlink--${type} interlink--missing" href="#">${raw}</a>`;
      }
      const d = item.data;
      const href = d.url || '#';
      const label = escapeHtml(link.title || pickLabel(d));
      // Do not set link.exists here; we don’t own Eleventy page objects for backlinks
      link.href = href;
      return `<a class="interlink interlink--${type}" href="${href}">${label}</a>`;
    } catch {
      const raw = escapeHtml(link.title || link.name);
      return `<a class="interlink interlink--${type} interlink--missing" href="#">${raw}</a>`;
    }
  };
}

export function createArchiveResolvers() {
  /**
   * Accessors resolve from current page data, falling back to global names
   * added via registerArchive(eleventyConfig.addGlobalData)
   */
  const getProducts = (data) => data.archiveProductsEn || data.archiveAllProducts || data.archiveProducts || [];
  const getCharacters = (data) => data.archiveCharactersEn || data.archiveAllCharacters || data.archiveCharacters || [];
  const getSeries = (data) => data.archiveSeriesEn || data.archiveAllSeries || data.archiveSeries || [];

  const product = makeResolver(
    'product',
    getProducts,
    ['productSlug', 'product_id', 'title'],
    (d) => d.title || d.product_id || d.productSlug
  );

  const character = makeResolver(
    'character',
    getCharacters,
    ['charSlug', 'name', 'title'],
    (d) => d.name || d.title || d.charSlug
  );

  const series = makeResolver(
    'series',
    getSeries,
    ['seriesSlug', 'title'],
    (d) => d.title || d.seriesSlug
  );

  return new Map([
    ['product', product],
    ['character', character],
    ['series', series],
  ]);
}

