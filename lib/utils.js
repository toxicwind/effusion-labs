/**
 * Miscellaneous utility helpers used across the codebase.
 * @module utils
 */

const fs = require('fs');

/** Simple file cache keyed by path */
const fileCache = new Map();

/**
 * Return the ordinal suffix for a day number.
 * @param {number} n
 * @returns {string}
 */
function ordinalSuffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
}

/**
 * Read a file with caching based on modification time.
 * Returns null if the file cannot be read.
 * @param {string} p
 * @returns {string|null}
 */
function readFileCached(p) {
  try {
    const stat = fs.statSync(p);
    const cached = fileCache.get(p);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.data;
    }
    const data = fs.readFileSync(p, 'utf8');
    fileCache.set(p, { mtimeMs: stat.mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}

module.exports = { ordinalSuffix, readFileCached };
