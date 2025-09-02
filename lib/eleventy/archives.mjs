// ESM only; no external deps
import fs from "node:fs";
import path from "node:path";

const TYPES = ["products", "characters", "series"];

// Accept both layouts: src/content/archives OR src/archives (or plain archives)
const CANDIDATES = [
  path.join("src", "content", "archives"),
  path.join("src", "archives"),
  "archives",
];

const toPosix = (p) => p.replaceAll("\\", "/");
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const ARCHIVES_BASE = CANDIDATES.find(exists) ?? CANDIDATES[0]; // best-effort

// Tiny, safe slugify (no dep)
function slugify(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "item";
}

function simplifyForm(form) {
  const f = String(form || "").toLowerCase();
  if (!f) return "";
  if (/(pendant|keychain)/.test(f)) return "pendant";
  if (/plush/.test(f)) return "plush";
  if (/figure/.test(f)) return "figure";
  if (/blind\s*box/.test(f)) return "blind-box";
  return "";
}

function canonicalProductSlug(d) {
  // Naming Canon: <brand>-<line>-<character>-<product-core>[-<variant-min>]
  const brand = d.brand || d.company || d.companySlug || "";
  const line = d.line || d.lineSlug || "";
  const character = d.character || d.charSlug || "";
  // Prefer explicit series/title; fall back to product_id token after pruning
  const core = d.series || d.product_title || d.title || "";
  const form = simplifyForm(d.form);
  const tokens = [brand, line, character, core, form].filter(Boolean).map(slugify);
  // Strip volatiles from any concatenated source (series often contains parens/dates already removed by slugify)
  const base = tokens.join("-").replace(/-(std|xl|s|m|l|reg-[a-z]{2}|\d{8}|\d+(?:cm|mm|in))\b/g, "");
  return base.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function titleFromSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function walkJsonFiles(dirAbs) {
  const out = [];
  if (!exists(dirAbs)) return out;
  for (const ent of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const p = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) out.push(...walkJsonFiles(p));
    else if (ent.isFile() && p.endsWith(".json")) out.push(p);
  }
  return out;
}

// Parse path → industry/category/company/line/section/locale
function parsePath(absPath) {
  const rel = toPosix(path.relative(ARCHIVES_BASE, absPath));
  const parts = rel.split("/"); // e.g. ["collectables","designer-toys","pop-mart","the-monsters","products","foo.json"]
  const file = parts.at(-1);
  let section, line, company, category, industry, locale = "en";

  const i18nIdx = parts.lastIndexOf("i18n");
  if (i18nIdx !== -1) {
    locale   = parts[i18nIdx + 1] || "en";
    section  = parts[i18nIdx + 2];
    line     = parts[i18nIdx - 1];
    company  = parts[i18nIdx - 2];
    category = parts[i18nIdx - 3];
    industry = parts[i18nIdx - 4];
  } else {
    section  = parts.at(-2);
    line     = parts.at(-3);
    company  = parts.at(-4);
    category = parts.at(-5);
    industry = parts.at(-6);
  }

  return {
    file,
    section,
    line,
    company,
    category,
    industry,
    locale,
    rel,
  };
}

function buildUrl({ industry, category, company, line, section, slug }) {
  // Legacy hierarchical path (still used for hub pages)
  return `/archives/${industry}/${category}/${company}/${line}/${section}/${slug}/`;
}

function normalizeData(absPath) {
  const raw = JSON.parse(fs.readFileSync(absPath, "utf8"));
  const { section, line, company, category, industry, locale } = parsePath(absPath);
  const fileSlug = path.basename(absPath, ".json");

  // IDs/slugs by section
  const productId   = raw.product_id ?? raw.id ?? raw.slug ?? fileSlug;
  const characterId = raw.slug ?? raw.name ?? raw.character ?? fileSlug;
  const seriesId    = raw.slug ?? raw.title ?? fileSlug;

  const lineSlug    = slugify(line);
  const companySlug = slugify(company);
  const categorySlug= slugify(category);
  const industrySlug= slugify(industry);

  const data = {
    // lineage
    industry, industrySlug,
    category, categorySlug,
    company,  companySlug,
    line,     lineSlug,
    section,  locale,

    // paths + provenance
    __source: toPosix(absPath),
    __rel: toPosix(path.relative(ARCHIVES_BASE, absPath)),

    // products
    product_id: productId,
    productSlug: slugify(productId),
    // characters
    name: raw.name ?? null,
    charSlug: slugify(characterId),
    // series
    seriesSlug: slugify(seriesId),
    title: raw.title ?? raw.name ?? productId,

    // passthrough
    ...raw,
  };

  // Precompute URLs (handy in templates)
  if (section === "products") {
    // Compute canonical slug (short) and preserve legacy/aliases
    const canon = canonicalProductSlug({
      brand: raw.brand,
      company: companySlug,
      line: raw.line || line,
      lineSlug,
      character: raw.character || raw.char || raw.name,
      charSlug: data.charSlug,
      series: raw.series,
      product_title: raw.product_title,
      title: raw.title,
      product_id: data.product_id,
      form: raw.form,
    });

    data.slugCanonical = canon || data.productSlug;
    data.canonicalUrl = `/archives/product/${data.slugCanonical}/`;
    // Legacy long route (kept for references that still use it)
    data.urlLegacy = buildUrl({
      industry: industrySlug, category: categorySlug, company: companySlug,
      line: lineSlug, section: "products", slug: data.productSlug,
    });
    const aliasSet = new Set();
    if (data.productSlug && data.productSlug !== data.slugCanonical) aliasSet.add(data.productSlug);
    // Accept optional aliases embedded in JSON files in future
    if (Array.isArray(raw.slugAliases)) raw.slugAliases.forEach((s)=> s && aliasSet.add(slugify(s)));
    data.slugAliases = Array.from(aliasSet);
    // Aliases and legacy deep path collection
    data.legacyPaths = [data.urlLegacy, ...data.slugAliases.map((a)=> `/archives/product/${a}/`)];
  } else if (section === "characters") {
    data.canonicalUrl = `/archives/character/${data.charSlug}/`;
    data.urlLegacy = buildUrl({
      industry: industrySlug, category: categorySlug, company: companySlug,
      line: lineSlug, section: "characters", slug: data.charSlug,
    });
  } else if (section === "series") {
    data.canonicalUrl = `/archives/series/${data.seriesSlug}/`;
    data.urlLegacy = buildUrl({
      industry: industrySlug, category: categorySlug, company: companySlug,
      line: lineSlug, section: "series", slug: data.seriesSlug,
    });
  }

  // Also useful for headings
  data.lineTitle    = titleFromSlug(line);
  data.companyTitle = titleFromSlug(company);
  data.categoryTitle= titleFromSlug(category);
  data.industryTitle= titleFromSlug(industry);

  return { data };
}

function aggregateCompanies(items) {
  // company key = `${industry}/${category}/${company}`
  const map = new Map();
  for (const it of items) {
    const d = it.data;
    const key = `${d.industrySlug}/${d.categorySlug}/${d.companySlug}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        industry: d.industry, industrySlug: d.industrySlug,
        category: d.category, categorySlug: d.categorySlug,
        company:  d.company,  companySlug:  d.companySlug,
        companyTitle: d.companyTitle,
        lines: new Map(), // lineSlug -> { lineSlug, lineTitle }
      });
    }
    const comp = map.get(key);
    if (!comp.lines.has(d.lineSlug)) {
      comp.lines.set(d.lineSlug, {
        lineSlug: d.lineSlug,
        lineTitle: d.lineTitle,
      });
    }
  }
  return Array.from(map.values()).map((c) => ({
    ...c,
    lines: Array.from(c.lines.values()).sort((a,b)=>a.lineTitle.localeCompare(b.lineTitle)),
  })).sort((a,b)=>a.companyTitle.localeCompare(b.companyTitle));
}

// Public API ------------------------------------------------------------
export default function registerArchive(eleventyConfig) {
  const files = walkJsonFiles(ARCHIVES_BASE);
  const normalized = files
    .map(normalizeData)
    // keep only known sections (guard against stray JSON)
    .filter((it) => TYPES.includes(it.data.section));

  const archiveProducts   = normalized.filter((it) => it.data.section === "products");
  const archiveCharacters = normalized.filter((it) => it.data.section === "characters");
  const archiveSeries     = normalized.filter((it) => it.data.section === "series");

  // Locale-scoped unique helpers
  const uniqueBy = (arr, key) => {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const v = x?.data?.[key];
      if (!seen.has(v)) { seen.add(v); out.push(x); }
    }
    return out;
  };
  const archiveProductsEn   = uniqueBy(archiveProducts.filter(x => x.data.locale === 'en'), 'productSlug');
  const archiveCharactersEn = uniqueBy(archiveCharacters.filter(x => x.data.locale === 'en'), 'charSlug');
  const archiveSeriesEn     = uniqueBy(archiveSeries.filter(x => x.data.locale === 'en'), 'seriesSlug');

  // Stable, non-dynamic collection names
  eleventyConfig.addCollection("archiveProducts",   () => archiveProducts);
  eleventyConfig.addCollection("archiveCharacters", () => archiveCharacters);
  eleventyConfig.addCollection("archiveSeries",     () => archiveSeries);

  // Useful filters for scoping in templates
  eleventyConfig.addFilter("byLine",     (arr, lineSlug)     => (arr ?? []).filter((x) => x.data.lineSlug === slugify(lineSlug)));
  eleventyConfig.addFilter("byCompany",  (arr, companySlug)  => (arr ?? []).filter((x) => x.data.companySlug === slugify(companySlug)));
  eleventyConfig.addFilter("byLocale",   (arr, locale)       => (arr ?? []).filter((x) => x.data.locale === (locale || "en")));
  eleventyConfig.addFilter("uniqueBy",   (arr, key) => {
    const seen = new Set(); const out = [];
    for (const x of arr ?? []) { const v = x?.data?.[key]; if (!seen.has(v)) { seen.add(v); out.push(x); } }
    return out;
  });

  // Global data for hub pages/navigation
  const companies = aggregateCompanies(normalized);
  const linesFlat = normalized
    .map((it) => ({
      industry: it.data.industry, industrySlug: it.data.industrySlug,
      category: it.data.category, categorySlug: it.data.categorySlug,
      company:  it.data.company,  companySlug: it.data.companySlug,
      line:     it.data.line,     lineSlug:    it.data.lineSlug,
      lineTitle:it.data.lineTitle,
    }))
    .filter((v, i, arr) => arr.findIndex(x => x.lineSlug === v.lineSlug && x.companySlug === v.companySlug) === i)
    .sort((a,b)=> a.lineTitle.localeCompare(b.lineTitle));

  if (typeof eleventyConfig.addGlobalData === "function") {
    eleventyConfig.addGlobalData("archiveCompanies", companies);
    eleventyConfig.addGlobalData("archiveLines", linesFlat);
    // Expose raw normalized collections for easy pagination in templates
    eleventyConfig.addGlobalData("archiveAllProducts", archiveProducts);
    eleventyConfig.addGlobalData("archiveAllCharacters", archiveCharacters);
    eleventyConfig.addGlobalData("archiveAllSeries", archiveSeries);
    eleventyConfig.addGlobalData("archiveProductsEn", archiveProductsEn);
    eleventyConfig.addGlobalData("archiveCharactersEn", archiveCharactersEn);
    eleventyConfig.addGlobalData("archiveSeriesEn", archiveSeriesEn);
  }

  // Nice to have for debugging
  console.log(`🗂  Archives loaded from "${ARCHIVES_BASE}": ${normalized.length} items (${archiveProducts.length} products, ${archiveCharacters.length} characters, ${archiveSeries.length} series)`);

  // Emit reports + collision handling (post-load; safe to compute once)
  const collisions = new Map();
  const canonIndex = new Map();
  for (const it of archiveProducts) {
    const canon = it.data.slugCanonical || it.data.productSlug;
    if (canonIndex.has(canon)) {
      if (!collisions.has(canon)) collisions.set(canon, []);
      collisions.get(canon).push(it);
    } else {
      canonIndex.set(canon, it);
    }
  }

  // Resolve collisions deterministically: append -v2, -v3 ...
  for (const [slug, items] of collisions.entries()) {
    let counter = 2;
    for (const it of items) {
      const newSlug = `${slug}-v${counter++}`;
      it.data.slugCanonical = newSlug;
      it.data.canonicalUrl = `/archives/product/${newSlug}/`;
      // Add previous slug as alias
      const s = new Set(it.data.slugAliases || []);
      s.add(slug);
      it.data.slugAliases = Array.from(s);
      it.data.legacyPaths = [it.data.urlLegacy, ...it.data.slugAliases.map((a)=> `/archives/product/${a}/`)];
    }
  }

  // Attach to global data for generators and validators
  eleventyConfig.addGlobalData("archiveProductMap", archiveProducts.map(p => ({
    id: p.data.product_id,
    title: p.data.title || p.data.product_title || p.data.product_id,
    slugCanonical: p.data.slugCanonical,
    canonicalUrl: p.data.canonicalUrl,
    slugAliases: p.data.slugAliases || [],
    legacyPaths: p.data.legacyPaths || [],
  })));
}
