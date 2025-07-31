// Custom markdown-it extensions used by Eleventy
/**
 * Collection of markdown-it extension functions for footnotes, embeds and links.
 * @module markdownExtensions
 */

/**
 * Enhance the default footnote output to support local display and hybrid blocks.
 * @param {import('markdown-it')} md - markdown-it instance to mutate
 */
function hybridFootnoteDefinitions(md) {
  const originalFootnoteOpen = md.renderer.rules.footnote_open || function(tokens, idx, options, env, slf) {
    let id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf);
    if (tokens[idx].meta.subId > 0) id += `:${tokens[idx].meta.subId}`;
    return `<li id="fn${id}" class="footnote-item">`;
  };

  const originalFootnoteClose = md.renderer.rules.footnote_close || function() {
    return '</li>\n';
  };

  const originalFootnoteAnchor = md.renderer.rules.footnote_anchor || function(tokens, idx, options, env, slf) {
    let id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf);
    if (tokens[idx].meta.subId > 0) id += `:${tokens[idx].meta.subId}`;
    return ` <a href="#fnref${id}" class="footnote-backref">\u21a9\uFE0E</a>`;
  };

  md.renderer.rules.footnote_reference_open = (tokens, idx, _opts, env) => {
    const label = tokens[idx].meta?.label;
    const id = label && env.footnotes?.refs?.hasOwnProperty(':' + label)
      ? env.footnotes.refs[':' + label]
      : 0;
    const n = id + 1;
    env.__currentFootnoteId = n;
    return `<div id="fn${n}" class="footnote-local"><div class="footnote-content">`;
  };

  md.renderer.rules.footnote_reference_close = (_t, _i, _o, env) =>
    `</div> <a href="#fnref${env.__currentFootnoteId}" class="footnote-backref">↩︎</a></div>\n`;

  md.renderer.rules.footnote_block_open = () => '<section class="footnotes-hybrid">\n';
  md.renderer.rules.footnote_block_close = () => '</section>\n';

  md.renderer.rules.footnote_open = function(tokens, idx, options, env, slf) {
    const original = originalFootnoteOpen(tokens, idx, options, env, slf);
    return original.replace('class="footnote-item"', 'class="footnote-item footnote-enhanced"');
  };

  md.renderer.rules.footnote_close = originalFootnoteClose;
  md.renderer.rules.footnote_anchor = originalFootnoteAnchor;

  const originalRender = md.renderer.render.bind(md.renderer);
  md.renderer.render = function(tokens, options, env) {
    let html = originalRender(tokens, options, env);
    html = html.replace(/(<div class="footnote-content">[\s\S]*?)<p>\s*Source:/g, '$1<p class="footnote-source">Source:');
    return html;
  };
}

/**
 * Replace footnote references with popover-enabled anchors.
 * @param {import('markdown-it')} md - markdown-it instance to mutate
 */
function footnotePopover(md) {
  const originalFootnoteRef = md.renderer.rules.footnote_ref;
  if (!originalFootnoteRef) return;

  md.renderer.rules.footnote_ref = function(tokens, idx, options, env, self) {
    const { id, label = '' } = tokens[idx].meta || {};
    const list = env.footnotes && env.footnotes.list;
    if (!Array.isArray(list) || !list[id]?.tokens) {
      return originalFootnoteRef(tokens, idx, options, env, self);
    }

    const n = id + 1;
    let defHtml = '';
    try {
      defHtml = md.renderer.render(list[id].tokens, options, env).trim();
      defHtml = defHtml.replace(/<\/?p>/g, '');
    } catch {
      return originalFootnoteRef(tokens, idx, options, env, self);
    }
    const refId = `fn${n}`;
    return `<sup class="annotation-ref${label ? ' ' + label : ''}">` +
           `<a href="#fn${n}" id="fnref${n}" class="annotation-anchor" aria-describedby="popup-${refId}">[${n}]</a>` +
           `<span id="popup-${refId}" role="tooltip" class="annotation-popup">${defHtml}</span>` +
           `</sup>`;
  };
}

/**
 * Helper to define simple inline macros.
 * @param {string} name - macro name
 * @param {string} after - rule to insert after
 * @param {(value:string)=>string} toHtml - HTML generator
 */
const inlineMacro = (name, after, toHtml) => md => {
  md.inline.ruler.after(after, name, (state, silent) => {
    const m = state.src.slice(state.pos).match(new RegExp(`^@${name}\\(([^)]+)\\)`));
    if (!m) return false;
    if (!silent) state.push({ type: 'html_inline', content: toHtml(m[1]) });
    state.pos += m[0].length;
    return true;
  });
};

/** Inline audio embedding macro */
const audioEmbed = inlineMacro('audio', 'emphasis', src => `<audio controls class="audio-embed" src="${src}"></audio>`);

/** Inline QR-code embedding macro */
const qrEmbed = inlineMacro('qr', 'audio', s => {
  const src = encodeURIComponent(s);
  return `<img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${src}" alt="QR code">`;
});

/**
 * Add an external-link class and arrow to outbound links.
 * @param {import('markdown-it')} md - markdown-it instance
 */
function externalLinks(md) {
  const base = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrJoin('class', 'external-link');
    const nxt = tokens[idx + 1];
    if (nxt?.type === 'text') nxt.content = '↗ source';
    return base(tokens, idx, options, env, self);
  };
}

const mdItExtensions = [hybridFootnoteDefinitions, footnotePopover, audioEmbed, qrEmbed, externalLinks];

module.exports = { hybridFootnoteDefinitions, footnotePopover, audioEmbed, qrEmbed, externalLinks, mdItExtensions };
