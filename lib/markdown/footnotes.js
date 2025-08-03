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
  md.renderer.rules.footnote_reference_open = (tokens, idx, _opts, env) => {
    // Resolve numeric id consistently whether label-based or direct id.
    const { meta } = tokens[idx];
    const label = meta?.label;
    const id = (label && env.footnotes?.refs && Object.prototype.hasOwnProperty.call(env.footnotes.refs, ':' + label))
      ? env.footnotes.refs[':' + label]
      : meta?.id ?? 0;

    const n = id + 1;
    env.__currentFootnoteId = n;
    env.__fnBQDepth = 0; // track nested blockquotes within the explanation

    // Insulate from Tailwind Typography with not-prose and clarify semantics.
    return `<aside class="footnote-aside not-prose" role="note">
  <div id="fn${n}" class="footnote-local">
    <div class="footnote-content">`;
  };

  // Safe close: if the very next token isn't a blockquote, close the aside now.
  md.renderer.rules.footnote_reference_close = (tokens, idx, _opts, env) => {
    const n = env.__currentFootnoteId;
    const next = tokens[idx + 1];

    let out = `    </div>
    <a href="#fnref${n}" class="footnote-backref">↩︎</a>
  </div>\n`;

    if (!next || next.type !== 'blockquote_open') {
      env.__currentFootnoteId = null;
      env.__fnBQDepth = 0;
      out += `</aside>\n`;
    }
    return out;
  };

  // Disable default footnote tails.
  ['footnote_block_open','footnote_block_close','footnote_open','footnote_close',
   'footnote_anchor','footnote_body_open','footnote_body_close','footnote_caption']
    .forEach(rule => { md.renderer.rules[rule] = () => ''; });

  const origBQOpen  = md.renderer.rules.blockquote_open  || (()=>'<blockquote>');
  const origBQClose = md.renderer.rules.blockquote_close || (()=>'</blockquote>');

  md.renderer.rules.blockquote_open = (tokens, idx, opts, env, self) => {
    if (env.__currentFootnoteId) {
      // Depth-aware: decorate only the *first* blockquote as the explanation.
      const d = env.__fnBQDepth || 0;
      env.__fnBQDepth = d + 1;
      return d === 0 ? `<blockquote class="footnote-explanation">` : `<blockquote>`;
    }
    return origBQOpen(tokens, idx, opts, env, self);
  };

  md.renderer.rules.blockquote_close = (tokens, idx, opts, env, self) => {
    if (env.__currentFootnoteId) {
      // Close nested first; close the aside only when we exit depth 0.
      env.__fnBQDepth = Math.max((env.__fnBQDepth || 1) - 1, 0);
      if (env.__fnBQDepth === 0) {
        env.__currentFootnoteId = null;
        return `</blockquote>\n</aside>\n`;
      }
      return `</blockquote>`;
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
