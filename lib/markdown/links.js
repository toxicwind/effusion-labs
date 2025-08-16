/**
 * Add an external-link class and arrow to outbound links.
 * @param {import('markdown-it')} md - markdown-it instance
 */
function externalLinks(md) {
  const base = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href') || '';
    const isExternal = /^https?:\/\//.test(href);
    if (isExternal) {
      tokens[idx].attrJoin('class', 'external-link');
      const nxt = tokens[idx + 1];
      if (nxt?.type === 'text' && nxt.content.toLowerCase() === 'source') {
        nxt.content = '↗ source';
      }
    }
    return base(tokens, idx, options, env, self);
  };
}

module.exports = { externalLinks };
