/**
 * Footnote rendering tweaks for markdown-it.
 * - Disables footer output via footnote_tail.
 * - Renders inline popover markup for each reference.
 * - Captures definition tokens for later reuse.
 * @module footnotes
 */

/**
 * Enhance the default footnote output to support local display.
 * @param {import('markdown-it')} md markdown-it instance
 */
function hybridFootnoteDefinitions(md) {
  // 1. Start the <aside> and the footnote-local wrapper
  md.renderer.rules.footnote_reference_open = (tokens, idx, _opts, env) => {
    const label = tokens[idx].meta?.label;
    const id   = label && env.footnotes?.refs?.hasOwnProperty(':' + label)
               ? env.footnotes.refs[':' + label]
               : tokens[idx].meta.id;
    const n    = id + 1;
    env.__currentFootnoteId = n;

    return `<aside class="footnote-aside">
  <div id="fn${n}" class="footnote-local">
    <div class="footnote-content">`;
  };

  // 2. Close out the definition and the local wrapper
  md.renderer.rules.footnote_reference_close = (_tok, _idx, _opts, env) => {
    const n = env.__currentFootnoteId;
    return `    </div>
    <a href="#fnref${n}" class="footnote-backref">↩︎</a>
  </div>\n`;
  };

  // 3. Disable default footnote container output
  ['footnote_block_open','footnote_block_close','footnote_open','footnote_close',
   'footnote_anchor','footnote_body_open','footnote_body_close','footnote_caption']
    .forEach(rule => { md.renderer.rules[rule] = () => ''; });

  // 4. Capture the very next blockquote and close the aside
  const origBQOpen  = md.renderer.rules.blockquote_open  || (()=>'<blockquote>');
  const origBQClose = md.renderer.rules.blockquote_close || (()=>'</blockquote>');

  md.renderer.rules.blockquote_open = (tokens, idx, opts, env, self) => {
    if (env.__currentFootnoteId) {
      return `<blockquote class="footnote-explanation">`;
    }
    return origBQOpen(tokens, idx, opts, env, self);
  };

  md.renderer.rules.blockquote_close = (tokens, idx, opts, env, self) => {
    if (env.__currentFootnoteId) {
      env.__currentFootnoteId = null;
      return `</blockquote>
</aside>\n`;
    }
    return origBQClose(tokens, idx, opts, env, self);
  };
}

/**
 * Replace footnote references with popover-enabled anchors.
 * @param {import('markdown-it')} md markdown-it instance
 */
function footnotePopover(md) {
  const originalFootnoteRef = md.renderer.rules.footnote_ref;
  if (!originalFootnoteRef) return;

  md.renderer.rules.footnote_ref = function(tokens, idx, options, env, self) {
    const { id, label = '' } = tokens[idx].meta || {};
    const list = env.footnotes && env.footnotes.list;
    if (!Array.isArray(list) || !Array.isArray(list[id]?.tokens)) {
      return originalFootnoteRef(tokens, idx, options, env, self);
    }
    const n = id + 1;
    let defHtml = '';
    try {
      defHtml = md.renderer
        .render(list[id].tokens, { ...options, breaks: true }, env)
        .trim();
      defHtml = defHtml
        .replace(/<\/?p>/g, '')
        .replace(/\n+/g, '<br>');
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
 * Capture footnote definition tokens when footnote_tail is disabled.
 * @param {import('markdown-it')} md markdown-it instance
 */
function collectFootnoteTokens(md) {
  md.core.ruler.after('inline', 'collect_footnote_tokens', state => {
    const env = state.env;
    if (!env.footnotes || !Array.isArray(env.footnotes.list)) return;

    const stack = [];
    state.tokens.forEach((tok, idx) => {
      if (tok.type === 'footnote_reference_open') {
        stack.push({ id: tok.meta.label ? env.footnotes.refs[':' + tok.meta.label] : tok.meta.id, start: idx });
      } else if (tok.type === 'footnote_reference_close') {
        const entry = stack.pop();
        if (!entry) return;
        const target = env.footnotes.list[entry.id];
        if (!target) return;
        const tokens = state.tokens.slice(entry.start + 1, idx);
        let j = idx + 1;
        if (state.tokens[j]?.type === 'blockquote_open') {
          let level = 0;
          while (j < state.tokens.length) {
            const t = state.tokens[j];
            tokens.push(t);
            if (t.type === 'blockquote_open') level++;
            if (t.type === 'blockquote_close') {
              level--;
              if (level === 0) { j++; break; }
            }
            j++;
          }
        }
        tokens.forEach(tok => {
          if (tok.type === 'inline' && Array.isArray(tok.children)) {
            tok.children.forEach(child => {
              if (child.type === 'softbreak') {
                child.type = 'hardbreak';
                child.tag = 'br';
                child.markup = '<br />';
              }
            });
          }
        });
        target.tokens = tokens;
      }
    });
  });
}

/**
 * Disable markdown-it-footnote's tail injection behavior.
 * @param {import('markdown-it')} md markdown-it instance
 */
function disableFootnoteTail(md) {
  md.core.ruler.disable('footnote_tail');
}

module.exports = {
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  disableFootnoteTail
};
