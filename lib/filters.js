const fs = require('fs');
const { DateTime } = require('luxon');

/** Append ordinal suffix to a given day number */
const ord = n => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][n%10] || 'th');

/**
 * Format a Date into a human readable string.
 * @param {Date} d
 * @param {string} [zone='utc'] - timezone identifier
 * @returns {string}
 */
function readableDate(d, zone = 'utc') {
  if (!(d instanceof Date)) return '';
  const dt = DateTime.fromJSDate(d, { zone });
  return `${dt.toFormat('MMMM d')}${ord(dt.day)}, ${dt.toFormat('yyyy')}`;
}

/**
 * Return a date formatted for HTML date attributes.
 * @param {Date} d
 * @returns {string}
 */
function htmlDateString(d) {
  return d instanceof Date ? DateTime.fromJSDate(d, { zone: 'utc' }).toFormat('yyyy-MM-dd') : '';
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
        let raw;
        try {
          raw = fs.readFileSync(p, 'utf8');
        } catch {
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

module.exports = { readableDate, htmlDateString, limit, jsonify };
