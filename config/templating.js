// config/templating.js
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import { icons } from 'lucide';
import defaultAttributes from 'lucide/dist/esm/defaultAttributes.js';
import generateConceptMapJSONLD from '../utils/build/concept-map.js';
import seeded from '../utils/build/seeded.js';

// --- Inlined Utilities (for stability) ---
const fileCache = new Map();
function readFileCached(p) {
  try {
    const { mtimeMs } = fs.statSync(p);
    const cached = fileCache.get(p);
    if (cached?.mtimeMs === mtimeMs) return cached.data;
    const data = fs.readFileSync(p, 'utf8');
    fileCache.set(p, { mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}
function ordinalSuffix(n) {
  const abs = Math.abs(n);
  if (abs % 100 >= 11 && abs % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][abs % 10] || 'th';
}

function _isPresent(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

function fieldCounts(obj = {}, excludeKeys = []) {
  try {
    const o = (obj && typeof obj === 'object') ? obj : {};
    const sys = new Set([
      'industry','industrySlug','category','categorySlug','company','companySlug','line','lineSlug','section','locale',
      '__source','__rel','url','title','lineTitle','companyTitle','categoryTitle','industryTitle',
      'productSlug','product_id','charSlug','name','seriesSlug','page','collections',
      ...(Array.isArray(excludeKeys) ? excludeKeys : [])
    ]);
    const keys = Object.keys(o).filter((k) => !sys.has(k));
    const total = keys.length;
    let present = 0;
    for (const k of keys) if (_isPresent(o[k])) present += 1;
    return { total, present };
  } catch {
    return { total: 0, present: 0 };
  }
}

function fieldRatio(obj = {}, excludeKeys = []) {
  const { total, present } = fieldCounts(obj, excludeKeys);
  return `${present}/${total}`;
}

const len = (v) => Array.isArray(v) ? v.length : 0;

// --- Core Helpers ---
const toStr = (v) => String(v ?? '');
const slug = (s) => String(s ?? "").normalize("NFKD").toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
const escapeHtml = (str) => String(str ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// --- Filters ---
const defaultFilters = {
  readableDate: (d, zone = 'utc') => {
    if (!(d instanceof Date)) return '';
    const dt = DateTime.fromJSDate(d, { zone });
    return `${dt.toFormat('MMMM d')}${ordinalSuffix(dt.day)}, ${dt.toFormat('yyyy')}`;
  },
  htmlDateString: (d) => d instanceof Date ? DateTime.fromJSDate(d, { zone: 'utc' }).toFormat('yyyy-MM-dd') : '',
  readingTime: (text = '', wordsPerMinute = 200) => {
    const count = toStr(text).trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(count / wordsPerMinute));
    return `${minutes} min read`;
  },
  truncate: (str = '', n = 140) => {
    if (typeof str !== 'string' || n <= 0) return '';
    return str.length > n ? `${str.slice(0, n)}…` : str;
  },
  slugify: (str = '') => String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
  limit: (arr = [], n = 5) => Array.isArray(arr) ? arr.slice(0, n) : [],
  isNew: (d, days = 14) => {
    if (!(d instanceof Date)) return false;
    const now = DateTime.now().toUTC();
    const then = DateTime.fromJSDate(d, { zone: 'utc' });
    return now.diff(then, 'days').days <= days;
  },
  shout: (str = '') => toStr(str).toUpperCase(),
  money: (value = 0, code = '') => {
    const num = Number(value);
    const cur = toStr(code).toUpperCase();
    if (!cur || Number.isNaN(num)) return '';
    return `${cur} ${num.toFixed(2)}`;
  },
  yesNo: (v) => v ? 'Yes' : 'No',
  humanDate: (iso = '') => {
    if (typeof iso !== 'string' || !iso) return '';
    const d = DateTime.fromISO(iso, { zone: 'utc' });
    if (!d.isValid) return '';
    const fmt = d.toFormat('yyyy-LL-dd');
    return `<time datetime="${iso}">${fmt}</time>`;
  },
  date: (value, fmt = 'yyyy-LL-dd') => {
    try {
      let dt;
      if (value instanceof Date) dt = DateTime.fromJSDate(value, { zone: 'utc' });
      else if (typeof value === 'number') dt = DateTime.fromMillis(value, { zone: 'utc' });
      else if (typeof value === 'string') dt = DateTime.fromISO(value, { zone: 'utc' });
      else return '';
      return dt.isValid ? dt.toFormat(fmt) : '';
    } catch {
      return '';
    }
  },
  titleizeSlug: (str = '') => toStr(str).split('-').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
  hostname: (url = '') => {
    try { return new URL(url).hostname; } catch { return ''; }
  },
  absoluteUrl: (path = '', base = process.env.SITE_URL || '') => {
    try { return new URL(path, base).toString(); } catch { return path; }
  },
  conceptMapJSONLD: (pages = []) => JSON.stringify(generateConceptMapJSONLD(pages)),
  jsonify: (data) => {
    if (!Array.isArray(data)) return '[]';
    return JSON.stringify(
      data
        .map(page => {
          const p = page?.inputPath;
          if (!p) return null;
          let raw = readFileCached(p);
          if (raw === null) raw = `Error loading ${p}`;
          return {
            url: page.url,
            fileSlug: page.fileSlug,
            inputContent: raw,
            data: {
              title: page.data?.title || '',
              aliases: page.data?.aliases || []
            }
          };
        })
        .filter(Boolean)
    );
  },
  provenanceSources: (ref = '') => {
    if (typeof ref !== 'string' || ref.trim() === '') return [];
    const rel = ref.startsWith('/') ? ref.slice(1) : ref;
    const full = path.join(process.cwd(), 'src', rel);
    const raw = readFileCached(full);
    if (raw === null) return [];
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  },
  provenanceViewerUrl: (ref = '') => {
    if (typeof ref !== 'string' || !ref.includes('/provenance/')) return ref;
    const clean = ref.replace(/^\/*content\//, '');
    const parts = clean.split('/');
    const idx = parts.lastIndexOf('provenance');
    if (idx < 0 || !parts[idx+1]) return ref;
    const file = parts[idx+1].replace(/\.jsonl$/, '');
    const slug = file.replace(/--+/g, '-');
    const prefix = parts.slice(1, idx).join('/');
    return `/archives/${prefix}/provenance/${slug}/`;
  },
  provenanceDownloadUrl: (ref = '') => {
    if (typeof ref !== 'string' || !ref.includes('/provenance/')) return ref;
    const clean = ref.replace(/^\/*content\//, '');
    const parts = clean.split('/');
    const idx = parts.lastIndexOf('provenance');
    if (idx < 0 || !parts[idx+1]) return ref;
    const file = parts[idx+1].replace(/\.jsonl$/, '');
    const slug = file.replace(/--+/g, '-');
    const prefix = parts.slice(1, idx).join('/');
    return `/archives/${prefix}/provenance/${slug}.jsonl`;
  },
  fieldCounts,
  fieldRatio,
  len,
};

// --- Shortcodes ---
function specnote(variant, content, tooltip) {
  const cls = {
    soft: 'spec-note-soft',
    subtle: 'spec-note-subtle',
    liminal: 'spec-note-liminal',
    archival: 'spec-note-archival',
    ghost: 'spec-note-ghost'
  }[variant] || 'spec-note-soft';
  const safeTooltip = tooltip?.replace(/"/g, '&quot;') || '';
  return `<span class="${cls}" title="${safeTooltip}">${content}</span>`;
}

function createCalloutShortcode(eleventyConfig) {
  return function (content, opts = {}) {
    const md = eleventyConfig.markdownLibrary;
    const isObj = opts && typeof opts === 'object' && !Array.isArray(opts);
    const { title = "", kicker = "", variant = "neutral", position = "center", icon = "", headingLevel = 3 } = isObj ? opts : { title: opts };
    const safeTitle = escapeHtml(title);
    const id = `callout-${title ? slug(title) : Date.now()}`;
    const body = md.render(String(content), this.ctx ?? {});
    return `<aside class="callout callout--${variant}" role="note" aria-labelledby="${id}"><div class="callout-head"><h${headingLevel} id="${id}" class="callout-title">${icon ? `<span class="callout-icon">${icon}</span>` : ''}${safeTitle}</h${headingLevel}>${kicker ? `<p class="callout-kicker">${escapeHtml(kicker)}</p>` : ''}</div><div class="callout-body">${body}</div></aside>`;
  };
}

// --- Registration Functions ---
export function addFilters(eleventyConfig) {
  Object.entries(defaultFilters).forEach(([name, fn]) => eleventyConfig.addFilter(name, fn));
  
  const safeUpper = (value, fallback = "", coerce = false) => {
      if (typeof value === "string") return value.toUpperCase();
      if (value == null) return fallback;
      return coerce ? String(value).toUpperCase() : fallback;
  };
  eleventyConfig.addFilter("safe_upper", safeUpper);
  eleventyConfig.addFilter("compactUnique", (arr) => Array.from(new Set((arr || []).filter(Boolean))));

  const toJson = (value, spaces = 0) => JSON.stringify(value, null, spaces).replace(/</g, "\\u003C").replace(/-->/g, "\\u002D\\u002D>");
  eleventyConfig.addFilter("json", toJson);
  eleventyConfig.addNunjucksFilter("json", toJson);
  
  eleventyConfig.addFilter("lucide", (name, attrs = {}) => {
      try {
          if (!name || typeof name !== "string") return "";
          const toPascal = (s) => s.split(/[:._\-\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
          const key = toPascal(name);
          const node = icons[key] || icons[name];
          if (!node) return "";
          const attrsMerged = { ...defaultAttributes, ...attrs };
          const toAttrString = (obj) => Object.entries(obj).map(([k, v]) => `${k}="${escapeHtml(v)}"`).join(" ");
          const children = Array.isArray(node[2]) ? node[2].map(([tag, attr]) => `<${tag} ${toAttrString(attr)} />`).join("") : "";
          return `<svg ${toAttrString(attrsMerged)}>${children}</svg>`;
      } catch {
          return "";
      }
  });

  eleventyConfig.addFilter("byCharacter", (items, id) => {
      const target = slug(id);
      return (items ?? []).filter((p) => slug(p?.data?.charSlug ?? p?.data?.character) === target);
  });
  eleventyConfig.addFilter("bySeries", (items, id) => {
      const target = slug(id);
      return (items ?? []).filter((p) => slug(p?.data?.seriesSlug ?? p?.data?.series) === target);
  });
  eleventyConfig.addFilter("sortByReleaseDate", (items, dir = "asc") => {
      const arr = [...(items ?? [])];
      arr.sort((a, b) => String(a?.data?.release_date ?? "").localeCompare(String(b?.data?.release_date ?? "")));
      return dir === "desc" ? arr.reverse() : arr;
  });
  eleventyConfig.addFilter("seededShuffle", (arr, seed) => seeded.seededShuffle(arr, seed));
}

export function addShortcodes(eleventyConfig) {
  eleventyConfig.addShortcode("specnote", specnote);
  const callout = createCalloutShortcode(eleventyConfig);
  eleventyConfig.addPairedShortcode('callout', callout);
  eleventyConfig.addPairedShortcode('failbox', function (content, titleOrOpts, kicker) {
      const opts = (titleOrOpts && typeof titleOrOpts === 'object') ? { ...titleOrOpts, variant: 'error' } : { title: titleOrOpts, kicker, variant: 'error' };
      return callout.call(this, content, opts);
  });
}

