/**
 * Miscellaneous utility helpers used across the codebase.
 * @module utils
 */

/**
 * Return the ordinal suffix for a day number.
 * @param {number} n
 * @returns {string}
 */
function ordinalSuffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
}

module.exports = { ordinalSuffix };
