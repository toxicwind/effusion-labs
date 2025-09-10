const linkRegex = /\[\[([^|\]#]+)/g;
const context = {
  "@vocab": "https://schema.org/",
  source: { "@id": "source", "@type": "@id" },
  target: { "@id": "target", "@type": "@id" }
};


/** Normalize a title or slug for comparison */
function normalizeIdentifier(str = '') {
  return str.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Resolve a wiki-style link identifier to a page object.
 * Matches against page slug, title or aliases.
 * @param {Array<Object>} pages
 * @param {string} identifier
 * @returns {Object|undefined}
 */
function resolveLink(pages, identifier) {
  const norm = normalizeIdentifier(identifier);
  return pages.find(p => {
    const slug = normalizeIdentifier(p.url.replace(/\/?$/, '').split('/').pop());
    const title = p.data.title ? normalizeIdentifier(p.data.title) : '';
    const aliases = (p.data.aliases || []).map(normalizeIdentifier);
    return slug === norm || title === norm || aliases.includes(norm);
  });
}

/**
 * Build node entries for the JSON-LD graph.
 * @param {Array<Object>} pages
 * @returns {Array<Object>}
 */
function buildNodes(pages) {
  return pages.map(page => ({
    '@id': page.url,
    '@type': 'Node',
    name: page.data.title || page.url,
    category: page.data.tags && page.data.tags[0] ? page.data.tags[0] : ''
  }));
}

/**
 * Extract edges based on wiki-style links within page content.
 * @param {Array<Object>} pages
 * @returns {Array<Object>}
 */
function buildEdges(pages) {
  const edges = [];
  pages.forEach(page => {
    const content = page.data.content || '';
    let match;
    while ((match = linkRegex.exec(content))) {
      const target = resolveLink(pages, match[1].trim());
      if (target) {
        edges.push({
          '@id': `edge:${page.url}->${target.url}`,
          '@type': 'Edge',
          source: page.url,
          target: target.url
        });
      }
    }
  });
  return edges;
}

/**
 * Generate a JSON-LD graph for the concept map.
 * @param {Array<Object>} pages
 * @returns {Object}
 */
export default function generateConceptMapJSONLD(pages) {
  const nodes = buildNodes(pages);
  const edges = buildEdges(pages);
  return {
    "@context": context,
    '@graph': [...nodes, ...edges]
  };
}
