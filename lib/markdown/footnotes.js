/**
 * Footnote rendering tweaks for markdown-it.
 * - Enhances footnote references with inline popovers
 * - Renders footnotes as styled cards where they appear in the markdown
 * - Connects blockquotes that immediately follow footnote definitions
 * @module footnotes
 */

/**
 * Enhanced footnote rendering that keeps footnotes where they are in the markdown
 * and connects adjacent blockquotes to footnote content.
 * @param {import('markdown-it')} md markdown-it instance
 */
function hybridFootnoteDefinitions(md) {
  // Override footnote block rendering to use our card style
  md.renderer.rules.footnote_block_open = () => {
    return '<div class="footnotes-hybrid">\n';
  };

  md.renderer.rules.footnote_block_close = () => {
    return '</div>\n';
  };

  md.renderer.rules.footnote_open = (tokens, idx, options, env, slf) => {
    const id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf);
    const n = Number(tokens[idx].meta.id + 1).toString();
    
    return `<aside class="footnote-aside not-prose" role="note">
  <div id="fn${id}" class="footnote-local">
    <div class="footnote-content">`;
  };

  md.renderer.rules.footnote_close = () => {
    return `    </div>
  </div>
</aside>\n`;
  };

  md.renderer.rules.footnote_anchor = (tokens, idx, options, env, slf) => {
    const id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf);
    return `    <a href="#fnref${id}" class="footnote-backref">↩︎</a>\n`;
  };

  // Track when we're inside a footnote for blockquote styling
  let insideFootnote = false;
  
  const origFootnoteOpen = md.renderer.rules.footnote_open;
  const origFootnoteClose = md.renderer.rules.footnote_close;
  
  md.renderer.rules.footnote_open = function(tokens, idx, options, env, slf) {
    insideFootnote = true;
    return origFootnoteOpen ? origFootnoteOpen(tokens, idx, options, env, slf) : '';
  };
  
  md.renderer.rules.footnote_close = function(tokens, idx, options, env, slf) {
    insideFootnote = false;
    return origFootnoteClose ? origFootnoteClose(tokens, idx, options, env, slf) : '';
  };

  // Style blockquotes that appear within footnotes
  const origBQOpen = md.renderer.rules.blockquote_open || ((tokens, idx) => '<blockquote>');
  const origBQClose = md.renderer.rules.blockquote_close || ((tokens, idx) => '</blockquote>');

  md.renderer.rules.blockquote_open = function(tokens, idx, options, env, slf) {
    if (insideFootnote) {
      return '<blockquote class="footnote-explanation">';
    }
    return origBQOpen(tokens, idx, options, env, slf);
  };

  md.renderer.rules.blockquote_close = function(tokens, idx, options, env, slf) {
    return origBQClose(tokens, idx, options, env, slf);
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
    const { id, subId = 0, label = '' } = tokens[idx].meta || {};
    const list = env.footnotes && env.footnotes.list;
    
    if (!Array.isArray(list) || !list[id]) {
      return originalFootnoteRef(tokens, idx, options, env, self);
    }
    
    const n = id + 1;
    const footnoteData = list[id];
    
    // Render the footnote content for the popover
    let defHtml = '';
    try {
      if (footnoteData.tokens && Array.isArray(footnoteData.tokens)) {
        // Create a temporary environment for rendering
        const tempEnv = { ...env };
        defHtml = md.renderer.render(footnoteData.tokens, options, tempEnv).trim();
      } else if (footnoteData.content) {
        defHtml = footnoteData.content;
      }
      
      // Clean up HTML for popover display - flatten block elements for inline display
      defHtml = defHtml
        // Convert blockquotes to italic spans (preserving content but making inline-safe)
        .replace(/<blockquote[^>]*>/g, '<em>')
        .replace(/<\/blockquote>/g, '</em>')
        // Remove all paragraph tags
        .replace(/<\/?p[^>]*>/g, '')
        // Convert line breaks
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
        
    } catch (error) {
      console.warn('Error rendering footnote content for popover:', error);
      return originalFootnoteRef(tokens, idx, options, env, self);
    }
    
    const refId = `fn${n}${subId > 0 ? `:${subId}` : ''}`;
    const caption = `[${n}${subId > 0 ? `:${subId}` : ''}]`;
    
    return `<sup class="annotation-ref${label ? ' ' + label : ''}">` +
           `<a href="#fn${n}" id="fnref${refId}" class="annotation-anchor" aria-describedby="popup-${refId}">${caption}</a>` +
           `<span id="popup-${refId}" role="tooltip" class="annotation-popup">${defHtml}</span>` +
           `</sup>`;
  };
}

/**
 * Connect blockquotes that immediately follow footnote definitions.
 * This runs during the parsing phase to merge adjacent content.
 * @param {import('markdown-it')} md markdown-it instance
 */
function connectFootnoteBlockquotes(md) {
  md.core.ruler.after('inline', 'connect_footnote_blockquotes', state => {
    const tokens = state.tokens;
    const newTokens = [];
    let i = 0;
    
    while (i < tokens.length) {
      const token = tokens[i];
      newTokens.push(token);
      
      // Look for footnote_reference_close followed by blockquote_open
      if (token.type === 'footnote_reference_close') {
        let j = i + 1;
        
        // Skip any whitespace/paragraph tokens
        while (j < tokens.length && 
               (tokens[j].type === 'paragraph_open' || 
                tokens[j].type === 'paragraph_close' ||
                (tokens[j].type === 'inline' && !tokens[j].content.trim()))) {
          j++;
        }
        
        // If we find a blockquote, it belongs to this footnote
        if (j < tokens.length && tokens[j].type === 'blockquote_open') {
          // Find the matching blockquote_close
          let level = 0;
          let k = j;
          
          while (k < tokens.length) {
            if (tokens[k].type === 'blockquote_open') level++;
            if (tokens[k].type === 'blockquote_close') {
              level--;
              if (level === 0) break;
            }
            k++;
          }
          
          // Move all the blockquote tokens inside the footnote
          // by inserting them before the footnote_reference_close
          const blockquoteTokens = tokens.slice(j, k + 1);
          
          // Remove the blockquote tokens from their original position
          // We'll skip them when we continue the main loop
          newTokens.pop(); // Remove the footnote_reference_close we just added
          
          // Add blockquote tokens
          newTokens.push(...blockquoteTokens);
          
          // Add the footnote_reference_close back
          newTokens.push(token);
          
          // Skip past the blockquote tokens in the main loop
          i = k + 1;
          continue;
        }
      }
      
      i++;
    }
    
    state.tokens = newTokens;
  });
}

/**
 * Disable the default footnote tail if you don't want footnotes at the end.
 * Comment this out if you want both inline AND end-of-document footnotes.
 * @param {import('markdown-it')} md markdown-it instance
 */
function disableFootnoteTail(md) {
  // md.core.ruler.disable('footnote_tail');
  // Leave footnote_tail enabled so footnotes render where they are in the markdown
}

module.exports = {
  hybridFootnoteDefinitions,
  footnotePopover,
  connectFootnoteBlockquotes,
  disableFootnoteTail
};