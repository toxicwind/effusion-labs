// lib/interlinkers/archives-resolvers.mjs
// Canonical-aware wikilink resolvers that target dynamic Eleventy archive pages
// produced by lib/eleventy/archives.mjs.
//
// Goals:
// - Resolve against normalized data (slugCanonical, canonicalUrl, slugAliases, legacyPaths)
// - Emit canonical URLs only (never alias/legacy)
// - Be defensive: never call String.match on non-strings; normalize inputs
// - Record unresolved wikilinks to artifacts/reports/interlinker-unresolved.json
//
// Usage examples in Markdown:
//   [[series:lets-checkmate]]
//   [[character:labubu|Labubu character]]
//   [[product:pop-mart-the-monsters-labubu-best-of-luck-plush]]

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

import fs from "node:fs";
import path from "node:path";

// --- Unresolved capture -------------------------------------------------
const unresolved = [];
const UNRESOLVED_OUT = path.join("artifacts", "reports", "interlinker-unresolved.json");
let wiredFlush = false;
function recordUnresolved(kind, key, ctx = {}) {
  unresolved.push({ kind, key: String(key || ""), page: ctx.page || null, when: new Date().toISOString() });
  if (!wiredFlush) {
    wiredFlush = true;
    process.on("exit", () => {
      try {
        fs.mkdirSync(path.dirname(UNRESOLVED_OUT), { recursive: true });
        fs.writeFileSync(UNRESOLVED_OUT, JSON.stringify({ count: unresolved.length, items: unresolved }, null, 2));
      } catch {}
    });
  }
}

// Build a canonical-first index for a given archive list.
// Keys are slugified to ensure robust matching.
function buildIndex(type, list) {
  const idx = new Map();
  const put = (key, entry) => { if (key) idx.set(slug(key), entry); };
  for (const it of list ?? []) {
    const d = it?.data ?? {};
    const href = typeof d.canonicalUrl === "string" && d.canonicalUrl
      ? d.canonicalUrl
      : `/archives/${type}/${type === 'product' ? (d.slugCanonical || d.productSlug || d.slug) : (d.charSlug || d.seriesSlug || d.slug)}/`;
    const label = d.title || d.name || d.product_id || d.productSlug || d.charSlug || d.seriesSlug || d.slug || href;
    const entry = { href, label, data: d };

    if (type === "product") {
      // Priority: slugCanonical → slugAliases[] → legacyPaths[] → ids/titles
      put(d.slugCanonical, entry);
      if (Array.isArray(d.slugAliases)) d.slugAliases.forEach((a) => put(a, entry));
      if (Array.isArray(d.legacyPaths)) {
        for (const p of d.legacyPaths) {
          const str = typeof p === "string" ? p : "";
          const m = str.match?.(/\/archives\/product\/([^/]+)\/?$/);
          if (m && m[1]) put(m[1], entry);
        }
      }
      put(d.productSlug, entry);
      put(d.product_id, entry);
      put(d.title, entry);
    } else if (type === "character") {
      put(d.charSlug, entry);
      put(d.name, entry);
      put(d.title, entry);
    } else if (type === "series") {
      put(d.seriesSlug, entry);
      put(d.title, entry);
    }
  }
  return idx;
}

function makeResolver(type, getList, pickLabel) {
  return (link, currentPage /*, interlinker */) => {
    try {
      const list = getList(currentPage?.data ?? {});
      const index = buildIndex(type, list);
      const wantKey = slug(link?.name ?? "");
      const entry = index.get(wantKey);
      const canonical = `/archives/${type}/${wantKey}/`;

      if (!entry) {
        // Default to canonical dynamic route; record unresolved for analysis.
        const raw = escapeHtml(link?.title || link?.name);
        recordUnresolved(type, link?.name, { page: currentPage?.inputPath || null });
        link.href = canonical;
        return `<a class="interlink interlink--${type} interlink--soft" href="${canonical}">${raw}</a>`;
      }

      const href = entry.href || canonical; // always canonical
      const label = escapeHtml(link?.title || pickLabel(entry.data) || entry.label);
      // Do not set link.exists here; we don’t own Eleventy page objects for backlinks
      link.href = href;
      return `<a class="interlink interlink--${type}" href="${href}">${label}</a>`;
    } catch {
      const raw = escapeHtml(link?.title || link?.name);
      const nameSlug = slug(link?.name);
      const canonical = `/archives/${type}/${nameSlug}/`;
      return `<a class="interlink interlink--${type} interlink--soft" href="${canonical}">${raw}</a>`;
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

  const product = makeResolver('product', getProducts, (d) => d.title || d.product_id || d.productSlug);

  const character = makeResolver('character', getCharacters, (d) => d.name || d.title || d.charSlug);

  const series = makeResolver('series', getSeries, (d) => d.title || d.seriesSlug);

  const map = new Map([
    ['product', product],
    ['character', character],
    ['series', series],
  ]);
  // Generic dispatcher: [[archive:product:foo]] / [[archive:series:bar]]
  map.set('archive', (link, currentPage) => {
    const raw = String(link?.name ?? '');
    const idx = raw.indexOf(':');
    if (idx === -1) return character(link, currentPage); // default bias is character
    const type = raw.slice(0, idx).trim();
    const name = raw.slice(idx + 1).trim();
    const sub = map.get(type) || character;
    const next = { ...link, name };
    return sub(next, currentPage);
  });
  // Synonyms prefixed with archive: to improve LLM legibility
  map.set('archive:product', product);
  map.set('archive:character', character);
  map.set('archive:series', series);
  return map;
}
