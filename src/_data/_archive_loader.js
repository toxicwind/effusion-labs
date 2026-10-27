const fs = require('node:fs');
const path = require('node:path');

const CANDIDATES = [
  path.join(process.cwd(), 'src', 'content', 'archives'),
  path.join(process.cwd(), 'src', 'archives'),
  path.join(process.cwd(), 'archives')
];

const TYPES = new Set(['products', 'characters', 'series']);

function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function chooseBase() {
  return CANDIDATES.find((p) => fs.existsSync(p)) || CANDIDATES[0];
}

function walkJson(dirAbs, out = []) {
  if (!fs.existsSync(dirAbs)) return out;
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) walkJson(p, out);
    else if (ent.isFile() && p.endsWith('.json')) out.push(p);
  }
  return out;
}

function parseMeta(base, absPath) {
  const rel = absPath.slice(base.length + 1).replaceAll('\\', '/');
  const parts = rel.split('/');

  let locale = 'en';
  let section = null;
  const i18nIdx = parts.lastIndexOf('i18n');
  if (i18nIdx !== -1) {
    locale = parts[i18nIdx + 1] || 'en';
    section = parts[i18nIdx + 2] || null;
  } else {
    section = parts.at(-2) || null;
  }

  return { locale, section };
}

let cache = null;

function loadArchiveData() {
  if (cache) return cache;

  const base = chooseBase();
  const files = walkJson(base);
  const allProducts = [];
  const allCharacters = [];
  const allSeries = [];
  const productsEn = [];
  const charactersEn = [];
  const seriesEn = [];
  const seenProductKeysAll = new Set();
  const seenProductKeysEn = new Set();
  const seenCharacterKeysAll = new Set();
  const seenCharacterKeysEn = new Set();
  const seenSeriesKeysAll = new Set();
  const seenSeriesKeysEn = new Set();

  for (const file of files) {
    const { locale, section } = parseMeta(base, file);
    if (!TYPES.has(section)) continue;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const wrapped = { data };

    if (section === 'products') {
      const key = String(
        data.slugCanonical || data.productSlug || data.slug || data.product_id || file
      );
      if (!seenProductKeysAll.has(key)) {
        seenProductKeysAll.add(key);
        allProducts.push(wrapped);
      }
      if (locale === 'en' && !seenProductKeysEn.has(key)) {
        seenProductKeysEn.add(key);
        productsEn.push(wrapped);
      }
    } else if (section === 'characters') {
      const normalized = {
        ...data,
        charSlug: data.charSlug || data.slug || slugify(data.name || '')
      };
      const key = String(normalized.charSlug || '');
      if (!key) continue;
      const wrappedNormalized = { data: normalized };
      if (!seenCharacterKeysAll.has(key)) {
        seenCharacterKeysAll.add(key);
        allCharacters.push(wrappedNormalized);
      }
      if (locale === 'en' && !seenCharacterKeysEn.has(key)) {
        seenCharacterKeysEn.add(key);
        charactersEn.push(wrappedNormalized);
      }
    } else if (section === 'series') {
      const normalized = {
        ...data,
        seriesSlug: data.seriesSlug || data.slug || slugify(data.name || '')
      };
      const key = String(normalized.seriesSlug || '');
      if (!key) continue;
      const wrappedNormalized = { data: normalized };
      if (!seenSeriesKeysAll.has(key)) {
        seenSeriesKeysAll.add(key);
        allSeries.push(wrappedNormalized);
      }
      if (locale === 'en' && !seenSeriesKeysEn.has(key)) {
        seenSeriesKeysEn.add(key);
        seriesEn.push(wrappedNormalized);
      }
    }
  }

  const mapSeen = new Set();
  const archiveProductMap = allProducts.map((p) => {
    const d = p.data || {};
    const canonicalSlug =
      d.slugCanonical || d.productSlug || d.slug || d.product_id || '';
    const canonicalUrl =
      d.canonicalUrl || (canonicalSlug ? `/archives/product/${canonicalSlug}/` : '/archives/');
    const slugAliases = Array.isArray(d.slugAliases) ? d.slugAliases : [];
    const legacyPaths = Array.isArray(d.legacyPaths)
      ? d.legacyPaths
      : slugAliases.map((s) => `/archives/product/${s}/`);

    return {
      id: d.product_id,
      title: d.title || d.product_title || d.name || d.product_id,
      slugCanonical: canonicalSlug,
      canonicalUrl,
      slugAliases,
      legacyPaths
    };
  }).filter((row) => {
    const key = row.canonicalUrl || row.slugCanonical || row.id || '';
    if (!key || mapSeen.has(key)) return false;
    mapSeen.add(key);
    return true;
  });

  cache = {
    archiveAllProducts: allProducts,
    archiveAllCharacters: allCharacters,
    archiveAllSeries: allSeries,
    archiveProductsEn: productsEn,
    archiveCharactersEn: charactersEn,
    archiveSeriesEn: seriesEn,
    archiveProductMap
  };

  return cache;
}

module.exports = { loadArchiveData };