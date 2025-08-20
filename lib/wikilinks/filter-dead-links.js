export const TEMPLATE_SYNTAX = /\{\{.*\}\}/;

/**
 * Remove templated wikilinks from a dead link report object.
 * @param {Record<string,string[]>} deadLinks
 * @returns {Record<string,string[]>}
 */
export function filterDeadLinks(deadLinks) {
  return Object.fromEntries(
    Object.entries(deadLinks).filter(([link]) => !TEMPLATE_SYNTAX.test(link)),
  );
}

export default { filterDeadLinks, TEMPLATE_SYNTAX };
