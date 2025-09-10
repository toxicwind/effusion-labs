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
