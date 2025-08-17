const generateConceptMapJSONLD = require("./concept-map");
const { DateTime } = require('luxon');
const path = require('node:path');
const { ordinalSuffix, readFileCached, webpageToMarkdown } = require('./utils');

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

module.exports = { conceptMapJSONLD, readableDate, htmlDateString, limit, jsonify, readingTime, slugify, truncate, webpageToMarkdown, isNew, shout, provenanceSources };