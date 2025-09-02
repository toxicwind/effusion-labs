/**
 * Archive helper utilities.
 * @module archive-utils
 */

/**
 * Filter archive products by company, line, and locale.
 * @param {Array} products - Collection items from archiveProducts.
 * @param {string} companySlug - Company slug to match.
 * @param {string} lineSlug - Product line slug to match.
 * @param {string} [locale="en"] - Locale to match (defaults to 'en').
 * @returns {Array} Filtered products belonging to the company/line/locale.
 */
export function lineProducts(products, companySlug, lineSlug, locale = "en") {
  return (products ?? []).filter(
    (p) =>
      p?.data?.companySlug === companySlug &&
      p?.data?.lineSlug === lineSlug &&
      p?.data?.locale === locale
  );
}

/**
 * Convenience wrapper to pull a named Eleventy collection and filter it by
 * company, line, and locale. Useful inside `.11ty.js` data functions.
 * @param {Object} collections - Eleventy collections object.
 * @param {string} name - Collection name (e.g. `"archiveProducts"`).
 * @param {string} companySlug - Company slug to match.
 * @param {string} lineSlug - Product line slug to match.
 * @param {string} [locale="en"] - Locale to match (defaults to 'en').
 * @returns {Array} Filtered collection items.
 */
export function lineCollection(
  collections = {},
  name,
  companySlug,
  lineSlug,
  locale = "en"
) {
  const source = collections?.[name] || [];
  return lineProducts(source, companySlug, lineSlug, locale);
}
