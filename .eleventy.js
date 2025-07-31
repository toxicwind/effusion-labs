const fs = require('fs');
const { DateTime } = require('luxon');

const interlinker = require('@photogabble/eleventy-plugin-interlinker');
const navigation = require('@11ty/eleventy-navigation');
const tailwind = require('eleventy-plugin-tailwindcss-4');
const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');

/* ── Enhanced Footnote System ──────────────────────────────────────────────── */

function hybridFootnoteDefinitions(md) {
  // Store original renderers instead of nullifying them
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

  // Override footnote definition rendering for local display
  md.renderer.rules.footnote_reference_open = (tokens, idx, _opts, env) => {
    const label = tokens[idx].meta?.label;
    const id = label && env.footnotes?.refs?.hasOwnProperty(':' + label)
      ? env.footnotes.refs[':' + label]
      : 0;
    const n = id + 1;
    env.__currentFootnoteId = n;

    // Create local footnote container
    return `<div id="fn${n}" class="footnote-local"><div class="footnote-content">`;
  };

  md.renderer.rules.footnote_reference_close = (_t, _i, _o, env) =>
    `</div> <a href="#fnref${env.__currentFootnoteId}" class="footnote-backref">↩︎</a></div>\n`;

  // Preserve block structure but modify for hybrid display
  md.renderer.rules.footnote_block_open = () => '<section class="footnotes-hybrid">\n';
  md.renderer.rules.footnote_block_close = () => '</section>\n';

  // Use original renderers for standard footnote items with enhanced styling
  md.renderer.rules.footnote_open = function(tokens, idx, options, env, slf) {
    const original = originalFootnoteOpen(tokens, idx, options, env, slf);
    return original.replace('class="footnote-item"', 'class="footnote-item footnote-enhanced"');
  };

  md.renderer.rules.footnote_close = originalFootnoteClose;
  md.renderer.rules.footnote_anchor = originalFootnoteAnchor;

  // Postprocess content: detect "Source:" and auto-split
  const originalRender = md.renderer.render.bind(md.renderer);
  md.renderer.render = function(tokens, options, env) {
    let html = originalRender(tokens, options, env);
    
    // Auto-split "Source:" in footnote content
    html = html.replace(
      /(<div class="footnote-content">[\s\S]*?)<p>\s*Source:/g,
      '$1<p class="footnote-source">Source:'
    );
    
    return html;
  };
}

function footnotePopover(md) {
  // Store the original footnote_ref renderer from markdown-it-footnote
  const originalFootnoteRef = md.renderer.rules.footnote_ref;
  
  if (!originalFootnoteRef) {
    console.warn('footnotePopover: No original footnote_ref renderer found');
    return;
  }

  // Enhance the original renderer with popover functionality
  md.renderer.rules.footnote_ref = function(tokens, idx, options, env, self) {
    const { id, label = "" } = tokens[idx].meta || {};
    const list = env.footnotes && env.footnotes.list;
    
    // If no footnote content available for popover, use original renderer
    if (!Array.isArray(list) || !list[id]?.tokens) {
      return originalFootnoteRef(tokens, idx, options, env, self);
    }

    const n = id + 1;
    let defHtml = '';
    
    // Render footnote content for popover
    try {
      defHtml = md.renderer.render(list[id].tokens, options, env).trim();
      // Clean up the HTML for popover display
      defHtml = defHtml.replace(/<\/?p>/g, ''); // Remove paragraph tags for inline display
    } catch (e) {
      // Fallback to original renderer on error
      return originalFootnoteRef(tokens, idx, options, env, self);
    }

    const refId = `fn${n}`;

    return `<sup class="annotation-ref${label ? " " + label : ""}">
      <a href="#fn${n}" id="fnref${n}" 
         class="annotation-anchor"
         aria-describedby="popup-${refId}">[${n}]</a>
      <span id="popup-${refId}" role="tooltip" class="annotation-popup">${defHtml}</span>
    </sup>`;
  };
}

/* ── Inline Macro Extensions ───────────────────────────────────────────────── */

const inlineMacro = (name, after, toHtml) => md => {
  md.inline.ruler.after(after, name, (state, silent) => {
    const m = state.src.slice(state.pos).match(new RegExp(`^@${name}\\(([^)]+)\\)`));
    if (!m) return false;
    if (!silent) state.push({ type: 'html_inline', content: toHtml(m[1]) });
    state.pos += m[0].length;
    return true;
  });
};

const audioEmbed = inlineMacro('audio', 'emphasis', src => 
  `<audio controls class="audio-embed" src="${src}"></audio>`
);

const qrEmbed = inlineMacro('qr', 'audio', s => {
  const src = encodeURIComponent(s);
  return `<img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${src}" alt="QR code">`;
});

function externalLinks(md) {
  const base = md.renderer.rules.link_open ||
    ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrJoin('class', 'external-link');
    const nxt = tokens[idx + 1];
    if (nxt?.type === 'text') nxt.content = '↗ source';
    return base(tokens, idx, options, env, self);
  };
}

const mdItExtensions = [
  hybridFootnoteDefinitions,
  footnotePopover,
  audioEmbed,
  qrEmbed,
  externalLinks
];

/* ── Filters ───────────────────────────────────────────────────────────────── */

const ord = n =>
  n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][n%10] || 'th';

const filters = {
  readableDate: (d, zone='utc') => {
    if (!(d instanceof Date)) return '';
    const dt = DateTime.fromJSDate(d, { zone });
    return `${dt.toFormat('MMMM d')}${ord(dt.day)}, ${dt.toFormat('yyyy')}`;
  },
  htmlDateString: d =>
    d instanceof Date ? DateTime.fromJSDate(d, { zone:'utc' }).toFormat('yyyy-MM-dd') : '',
  limit: (arr=[], n=5) => Array.isArray(arr) ? arr.slice(0, n) : [],
  jsonify: data => {
    if (!Array.isArray(data)) return '[]';
    return JSON.stringify(data.map(page => {
      const p = page?.inputPath; if (!p) return null;
      let raw; 
      try { 
        raw = fs.readFileSync(p,'utf8'); 
      } catch { 
        raw = `Error loading ${p}`; 
      }
      return { 
        url: page.url, 
        fileSlug: page.fileSlug, 
        inputContent: raw, 
        data: { 
          title: page.data?.title || '', 
          aliases: page.data?.aliases || [] 
        } 
      };
    }).filter(Boolean));
  }
};

/* ── Collections / paths ───────────────────────────────────────────────────── */

const baseContent = 'src/content';
const areas = ['sparks','concepts','projects','meta'];
const glob = d => `${baseContent}/${d}/**/*.md`;

/* ── Shortcodes ────────────────────────────────────────────────────────────── */

function specnote(variant, content, tooltip) {
  const cls = { 
    soft: 'spec-note-soft', 
    subtle: 'spec-note-subtle', 
    liminal: 'spec-note-liminal', 
    archival: 'spec-note-archival', 
    ghost: 'spec-note-ghost' 
  }[variant] || 'spec-note-soft';
  
  const safeTooltip = tooltip?.replace(/"/g,'&quot;') || '';
  return `<span class="${cls}" title="${safeTooltip}">${content}</span>`;
}

/* ── Eleventy Configuration ────────────────────────────────────────────────── */

module.exports = function(eleventyConfig) {
  // Plugin Configuration
  const plugins = [
    [ 
      interlinker, 
      { 
        defaultLayout: 'layouts/embed.njk', 
        resolvingFns: new Map([
          ['default', link => { 
            const href = link.href || link.link; 
            const label = link.title || link.name; 
            return `<a class="interlink" href="${href}">${label}</a>`;
          }]
        ]) 
      } 
    ],
    [ navigation ],
    [ 
      tailwind, 
      { 
        input: 'assets/css/tailwind.css', 
        output: 'assets/main.css', 
        minify: true 
      } 
    ]
  ];

  plugins.forEach(([plugin, opts = {}]) => eleventyConfig.addPlugin(plugin, opts));

  // Markdown Configuration with Enhanced Footnotes
  eleventyConfig.amendLibrary('md', md => {
    // Apply standard markdown-it plugins first
    md.use(markdownItFootnote);
    md.use(markdownItAttrs);
    
    // CRITICAL: Don't disable footnote_tail - it's essential for footnote processing
    // The original issue was caused by: md.core.ruler.disable('footnote_tail');
    
    // Apply our enhanced footnote extensions
    mdItExtensions.forEach(fn => {
      try {
        fn(md);
      } catch (error) {
        console.error(`Error applying markdown extension: ${error.message}`);
      }
    });
    
    return md;
  });

  // Filter Registration
  Object.entries(filters).forEach(([key, value]) => {
    eleventyConfig.addFilter(key, value);
  });

  // Collection Configuration
  areas.forEach(name => {
    eleventyConfig.addCollection(name, api => api.getFilteredByGlob(glob(name)));
  });
  
  eleventyConfig.addCollection('nodes', api => 
    api.getFilteredByGlob(areas.map(glob))
  );

  // Asset and File Handling
  eleventyConfig.addPassthroughCopy('src/assets');
  eleventyConfig.addPassthroughCopy({ 'src/favicon.ico': 'favicon.ico' });

  // Browser Sync Configuration
  eleventyConfig.setBrowserSyncConfig({ 
    index: 'index.html', 
    server: { baseDir: '_site' } 
  });

  // Shortcode Registration
  eleventyConfig.addShortcode('specnote', specnote);

  // Error Handling for Development
  eleventyConfig.on('eleventy.before', () => {
    console.log('🚀 Eleventy build starting with enhanced footnote system...');
  });

  eleventyConfig.on('eleventy.after', ({ results }) => {
    console.log(`✅ Eleventy build completed. Generated ${results.length} files.`);
  });

  // Return Configuration Object
  return {
    dir: { 
      input: 'src', 
      output: '_site', 
      includes: '_includes', 
      data: '_data' 
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    pathPrefix: '/'
  };
};