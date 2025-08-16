const TEMPLATE_SYNTAX = /\{\{.*\}\}/;

/**
 * Remove templated wikilinks from a dead link report object.
 * @param {Record<string,string[]>} deadLinks
 * @returns {Record<string,string[]>}
 */
function filterDeadLinks(deadLinks) {
  return Object.fromEntries(
    Object.entries(deadLinks).filter(([link]) => !TEMPLATE_SYNTAX.test(link)),
  );
}

module.exports = { filterDeadLinks, TEMPLATE_SYNTAX };
