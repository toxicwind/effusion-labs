/**
 * Remove anchors or wikilinks containing Nunjucks template braces.
 * @param {string} content
 * @returns {string}
 */
function removeTemplatedLinks(content) {
  if (typeof content !== 'string') return content;
  // Strip anchors with templated href values and wikilinks containing
  // Nunjucks-style braces. These links are placeholders that the
  // wikilink parser should ignore entirely.
  const anchorPattern = /<a[^>]*href="[^"]*{{[^}]+}}[^"]*"[^>]*>(.*?)<\/a>/gs;
  const wikilinkPattern = /\[\[[^\]]*{{[^}]+}}[^\]]*\]\]/g;
  return content
    .replace(anchorPattern, '$1')
    .replace(wikilinkPattern, '');
}

module.exports = { removeTemplatedLinks };
