const { DateTime } = require('luxon');
const { ordinalSuffix, readFileCached, webpageToMarkdown } = require('./utils');

let lucideIcons = null;
let lucideDefaults = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
};

try {
  const pkg = require('lucide');
  lucideIcons = pkg.icons || null;
  if (pkg.defaultAttributes) {
    lucideDefaults = { ...lucideDefaults, ...pkg.defaultAttributes };
  }
} catch {
  // optional dependency shape differences are tolerated
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const linkRegex = /\[\[([^#\]|]+)/g;

function normalizeIdentifier(str = '') {
  return String(str).toLowerCase().replace(/\s+/g, '-');
}

function resolveLink(pages = [], identifier = '') {
  const norm = normalizeIdentifier(identifier);
  return pages.find((p) => {
    const url = String(p?.url || '');
    const slug = normalizeIdentifier(url.replace(/\/?$/, '').split('/').pop() || '');
    const title = p?.data?.title ? normalizeIdentifier(p.data.title) : '';
    const aliases = Array.isArray(p?.data?.aliases)
      ? p.data.aliases.map(normalizeIdentifier)
      : [];
    return slug === norm || title === norm || aliases.includes(norm);
  });
}

function conceptMapJSONLD(pages = []) {
  const nodes = pages.map((page) => ({
    '@id': page.url,
    '@type': 'Node',
    name: page?.data?.title || page.url,
    category: page?.data?.tags?.[0] || ''
  }));

  const edges = [];
  for (const page of pages) {
    const content = String(page?.data?.content || '');
    linkRegex.lastIndex = 0;
    let match;
    while ((match = linkRegex.exec(content))) {
      const target = resolveLink(pages, String(match[1] || '').trim());
      if (target) {
        edges.push({
          '@id': `edge:${page.url}->${target.url}`,
          '@type': 'Edge',
          source: page.url,
          target: target.url
        });
      }
    }
  }

  return JSON.stringify({
    '@context': {
      '@vocab': 'https://schema.org/',
      source: { '@id': 'source', '@type': '@id' },
      target: { '@id': 'target', '@type': '@id' }
    },
    '@graph': [...nodes, ...edges]
  });
}

function attrsToString(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${escapeHtml(String(v))}"`)
    .join(' ');
}

function lucide(name = 'circle', attrs = {}) {
  const key = String(name || '').trim();
  const icon = lucideIcons?.[key];
  if (!icon || !Array.isArray(icon.iconNode)) {
    return `<svg ${attrsToString({ ...lucideDefaults, ...attrs, class: attrs?.class || 'icon-lucide-missing' })}></svg>`;
  }

  const svgAttrs = { ...lucideDefaults, ...attrs };
  const nodes = icon.iconNode
    .map(([tag, nodeAttrs]) => `<${tag} ${attrsToString(nodeAttrs)}></${tag}>`)
    .join('');

  return `<svg ${attrsToString(svgAttrs)}>${nodes}</svg>`;
}


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
  const count = String(text).trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(count / wordsPerMinute));
  return `${minutes} min read`;
}

/** Uppercase formatter used by templates */
function shout(str = '') {
  return String(str).toUpperCase();
}

function date(value, fmt = 'yyyy-MM-dd') {
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
}

function byLine(items = [], slug = '') {
  const key = String(slug || '');
  return Array.isArray(items)
    ? items.filter((p) => (p?.data?.lineSlug || p?.data?.line || '') === key)
    : [];
}

function byCompany(items = [], slug = '') {
  const key = String(slug || '');
  return Array.isArray(items)
    ? items.filter((p) => (p?.data?.companySlug || p?.data?.company || '') === key)
    : [];
}

function byLocale(items = [], locale = 'en') {
  const key = String(locale || 'en');
  return Array.isArray(items)
    ? items.filter((p) => (p?.data?.locale || 'en') === key)
    : [];
}

function compactUnique(values = []) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(values) ? values : []) {
    const s = String(v ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function setAttribute(obj = {}, key, value) {
  const base = obj && typeof obj === 'object' && !Array.isArray(obj) ? { ...obj } : {};
  base[key] = value;
  return base;
}

function json(value, spaces = 0) {
  try {
    return JSON.stringify(value ?? null, null, spaces)
      .replace(/</g, '\\u003C')
      .replace(/--!?>/g, '\\u002D\\u002D>');
  } catch {
    return 'null';
  }
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

module.exports = {
  readableDate,
  htmlDateString,
  limit,
  jsonify,
  readingTime,
  shout,
  date,
  byLine,
  byCompany,
  byLocale,
  compactUnique,
  setAttribute,
  json,
  slugify,
  lucide,
  conceptMapJSONLD,
  webpageToMarkdown
};
