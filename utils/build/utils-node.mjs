/**
 * Miscellaneous utility helpers used across the codebase.
 * @module utils
 */

import fs from 'node:fs';
import { webpageToMarkdown } from './webpageToMarkdown.js';

/** Simple file cache keyed by path */
const fileCache = new Map();

/**
 * Return the ordinal suffix for a day number.
 * @param {number} n
 * @returns {string}
 */
export function ordinalSuffix(n) {
  const abs = Math.abs(n);
  if (abs % 100 >= 11 && abs % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][abs % 10] || 'th';
}

/**
 * Read a file with caching based on modification time.
 * Returns null if the file cannot be read.
 * @param {string} p
 * @returns {string|null}
 */
export function readFileCached(p) {
  try {
    const { mtimeMs } = fs.statSync(p);
    const cached = fileCache.get(p);
    if (cached?.mtimeMs === mtimeMs) {
      return cached.data;
    }
    const data = fs.readFileSync(p, 'utf8');
    fileCache.set(p, { mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}

export { webpageToMarkdown };

export default { ordinalSuffix, readFileCached, webpageToMarkdown };
