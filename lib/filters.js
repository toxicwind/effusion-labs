import generateConceptMapJSONLD from './concept-map.js';
import { DateTime } from 'luxon';
import path from 'node:path';
import { ordinalSuffix, readFileCached, webpageToMarkdown } from './utils.js';

const toStr = v => String(v ?? '');


/**
 * Format a Date into a human readable string.
 * @param {Date} d
 * @param {string} [zone='utc'] - timezone identifier
 * @returns {string}
 */
function readableDate(d, zone = 'utc') {
  if (!(d instanceof Date)) return '';
  const dt = DateTime.fromJSDate(d, { zone });
  return `${dt.toFormat('MMMM d')}${ordinalSuffix(dt.day)}, ${dt.toFormat('yyyy')}`;
}

/**
 * Return a date formatted for HTML date attributes.
 * @param {Date} d
 * @returns {string}
 */
function htmlDateString(d) {
  return d instanceof Date ? DateTime.fromJSDate(d, { zone: 'utc' }).toFormat('yyyy-MM-dd') : '';
}

/** Estimate reading time in minutes */
function readingTime(text = '', wordsPerMinute = 200) {
  const count = toStr(text).trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(count / wordsPerMinute));
  return `${minutes} min read`;
}

const ELLIPSIS = '…';

/**
 * Truncate a string and append an ellipsis when exceeding length.
 * @param {string} str
 * @param {number} n
 * @returns {string}
 */
function truncate(str = '', n = 140) {
  if (typeof str !== 'string' || n <= 0) return '';
  return str.length > n ? `${str.slice(0, n)}${ELLIPSIS}` : str;
}

/**
 * Convert a string into a URL friendly slug.
 * @param {string} str
 * @returns {string}
 */
function slugify(str = '') {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/** Limit an array to n items */
function limit(arr = [], n = 5) {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

/** Determine if a date is within the last `days` days */
function isNew(d, days = 14) {
  if (!(d instanceof Date)) return false;
  const now = DateTime.now().toUTC();
  const then = DateTime.fromJSDate(d, { zone: 'utc' });
  return now.diff(then, 'days').days <= days;
}

/** Uppercase text for brutalist accents */
function shout(str = '') {
  return toStr(str).toUpperCase();
}

/** Format currency value with ISO code */
function money(value = 0, code = '') {
  const num = Number(value);
  const cur = toStr(code).toUpperCase();
  if (!cur || Number.isNaN(num)) return '';
  return `${cur} ${num.toFixed(2)}`;
}

/** Convert boolean to Yes/No */
function yesNo(v) {
  return v ? 'Yes' : 'No';
}

/** Render ISO date as YYYY-MM-DD within <time> */
function humanDate(iso = '') {
  if (typeof iso !== 'string' || !iso) return '';
  const d = DateTime.fromISO(iso, { zone: 'utc' });
  if (!d.isValid) return '';
  const fmt = d.toFormat('yyyy-LL-dd');
  return `<time datetime="${iso}">${fmt}</time>`;
}

/** Title-case a slug */
function titleizeSlug(str = '') {
  return toStr(str)
    .split('-')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/** Extract hostname from URL */
function hostname(url = '') {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Load provenance entries from a JSONL file reference.
 * @param {string} ref - provenance_ref path stored on product data
 * @returns {Array<Object>}
 */
function provenanceSources(ref = '') {
  if (typeof ref !== 'string' || ref.trim() === '') return [];
  const rel = ref.startsWith('/') ? ref.slice(1) : ref;
  const full = path.join(process.cwd(), 'src', rel);
  const raw = readFileCached(full);
  if (raw === null) return [];
  const lines = raw.trim().split('\n').filter(Boolean);
  return lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// Map `/content/archives/.../provenance/<file>.jsonl` → `/archives/.../provenance/<slug>/`
function provenanceViewerUrl(ref = '') {
  if (typeof ref !== 'string' || !ref.includes('/provenance/')) return ref;
  const clean = ref.replace(/^\/*content\//, ''); // remove leading /content/
  const parts = clean.split('/');
  // expect: archives/<industry>/<category>/<company>/<line>/provenance/<file>.jsonl
  const idx = parts.lastIndexOf('provenance');
  if (idx < 0 || !parts[idx+1]) return ref;
  const file = parts[idx+1].replace(/\.jsonl$/, '');
  const slug = file.replace(/--+/g, '-');
  const prefix = parts.slice(1, idx).join('/'); // drop leading 'archives'
  return `/archives/${prefix}/provenance/${slug}/`;
}

// Map to downloadable static copy alongside viewer
function provenanceDownloadUrl(ref = '') {
  if (typeof ref !== 'string' || !ref.includes('/provenance/')) return ref;
  const clean = ref.replace(/^\/*content\//, '');
  const parts = clean.split('/');
  const idx = parts.lastIndexOf('provenance');
  if (idx < 0 || !parts[idx+1]) return ref;
  const file = parts[idx+1].replace(/\.jsonl$/, '');
  const slug = file.replace(/--+/g, '-');
  const prefix = parts.slice(1, idx).join('/');
  return `/archives/${prefix}/provenance/${slug}.jsonl`;
}

/**
 * Serialize collection data for graph visualisation.
 * @param {Array<Object>} data - eleventy page objects
 * @returns {string}
 */
function jsonify(data) {
  if (!Array.isArray(data)) return '[]';
  return JSON.stringify(
    data
      .map(page => {
        const p = page?.inputPath;
        if (!p) return null;
        let raw = readFileCached(p);
        if (raw === null) {
          raw = `Error loading ${p}`;
        }
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
}

function conceptMapJSONLD(pages = []) {
  return JSON.stringify(generateConceptMapJSONLD(pages));
}

export {
  conceptMapJSONLD,
  readableDate,
  htmlDateString,
  limit,
  jsonify,
  readingTime,
  slugify,
  truncate,
  webpageToMarkdown,
  isNew,
  shout,
  money,
  yesNo,
  humanDate,
  titleizeSlug,
  hostname,
  provenanceSources,
  provenanceViewerUrl,
  provenanceDownloadUrl,
};

// Defer default export assembly until end of file (so we can include helper filters)

// ---- Archive utility filters (field counts, status) ----
// These are appended to the default export at runtime by register.mjs
// but also exported as named functions for direct import if needed.

/** Determine if a value is considered present/non-empty */
function _isPresent(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true; // numbers/booleans
}

/** Count fields on an object, excluding known system keys. */
function fieldCounts(obj = {}, excludeKeys = []) {
  try {
    const o = (obj && typeof obj === 'object') ? obj : {};
    const sys = new Set([
      // lineage + slugs
      'industry','industrySlug','category','categorySlug','company','companySlug','line','lineSlug','section','locale',
      // computed/meta
      '__source','__rel','url','title','lineTitle','companyTitle','categoryTitle','industryTitle',
      // ids/slugs
      'productSlug','product_id','charSlug','name','seriesSlug',
      // eleventy internals occasionally present
      'page','collections'
    ].concat(Array.isArray(excludeKeys) ? excludeKeys : []));

    const keys = Object.keys(o).filter((k) => !sys.has(k));
    const total = keys.length;
    let present = 0;
    for (const k of keys) if (_isPresent(o[k])) present += 1;
    return { total, present };
  } catch {
    return { total: 0, present: 0 };
  }
}

/** Convenience: return present/total as a string like "12/18". */
function fieldRatio(obj = {}, excludeKeys = []) {
  const { total, present } = fieldCounts(obj, excludeKeys);
  return `${present}/${total}`;
}

/** Safe length for arrays; 0 otherwise */
function len(v) { return Array.isArray(v) ? v.length : 0; }

export { fieldCounts, fieldRatio, len };

// Assemble default export with all filters (including helpers above)
const __defaultFilters = {
  conceptMapJSONLD,
  readableDate,
  htmlDateString,
  limit,
  jsonify,
  readingTime,
  slugify,
  truncate,
  webpageToMarkdown,
  isNew,
  shout,
  money,
  yesNo,
  humanDate,
  titleizeSlug,
  hostname,
  provenanceSources,
  provenanceViewerUrl,
  provenanceDownloadUrl,
  fieldCounts,
  fieldRatio,
  len,
};

export default __defaultFilters;
