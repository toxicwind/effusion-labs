const fs = require('fs');
const { DateTime } = require('luxon');

const interlinker = require('@photogabble/eleventy-plugin-interlinker');
const navigation = require('@11ty/eleventy-navigation');
const tailwind = require('eleventy-plugin-tailwindcss-4');
const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');

/* ── Markdown-it extensions ───────────────────────────────────────────────── */

function relaxFootnoteBlockquotes(md) {
  md.core.ruler.before('block', 'relax_footnote_bq', state => {
    const re = /(^\[\^[^\]]+]:[^\n]*\r?\n)((?:>.*(?:\r?\n|$))+)/gm;
    state.src = state.src.replace(
      re,
      (m, head, bqs) => head + bqs.replace(/^>/gm, '    >')
    );
  });
}

function hybridFootnoteDefinitions(md) {
  // Override how footnotes are opened and closed
  md.renderer.rules.footnote_reference_open = (tokens, idx, _opts, env) => {
    const label = tokens[idx].meta?.label;
    const id = label && env.footnotes?.refs?.hasOwnProperty(':' + label)
      ? env.footnotes.refs[':' + label]
      : 0;
    const n = id + 1;
    env.__currentFootnoteId = n;

    // Start container with inner .footnote-content
    return `<div id="fn${n}" class="footnote-local"><div class="footnote-content">`;
  };

  md.renderer.rules.footnote_reference_close = (_t, _i, _o, env) =>
    `</div> <a href="#fnref${env.__currentFootnoteId}" class="footnote-backref">↩︎</a></div>\n`;

  // Override footnote rendering for content
  const defaultFootnoteInner = md.renderer.renderToken.bind(md.renderer);

  md.renderer.rules.footnote_block_open = () => '';
  md.renderer.rules.footnote_block_close = () => '';

  // Postprocess footnote tokens to detect "Source:" lines
  md.renderer.rules.footnote_open = (tokens, idx, options, env, self) => {
    return ''; // already handled in reference_open
  };

  md.renderer.rules.footnote_close = (tokens, idx, options, env, self) => {
    return ''; // handled in reference_close
  };

  md.renderer.rules.footnote_anchor = () => '';

  // Override how footnote body tokens are rendered
  md.renderer.rules.footnote_body_open = () => '';
  md.renderer.rules.footnote_body_close = () => '';

  // Process individual tokens in footnote content
  md.renderer.rules.footnote_caption = () => ''; // skip captions, we use numbers

  // Postprocess content: detect "Source:" and auto-split
  md.renderer.renderFootnoteTokens = function(tokens, options, env) {
    const html = md.renderer.render(tokens, options, env);

    // Automatically split "Source:" into its own paragraph with class
    return html.replace(
      /(?:^|\n)<p>\s*Source:/g,
      '\n<p class="footnote-source">Source:'
    );
  };
}


function footnotePopover(md) {
  // Capture the original renderer (with its expected signature)
  const fallback = md.renderer.rules.footnote_ref || function(tokens, idx, options, env, self) {
    // Delegate back to the core renderer if nothing else
    return render_footnote_ref(tokens, idx, options, env, self);
  };

  // Override with exactly 5 params, and call fallback with them
  md.renderer.rules.footnote_ref = function(tokens, idx, options, env, self) {
    const { id, label = "" } = tokens[idx].meta || {};
    const list = env.footnotes && env.footnotes.list;
    if (!Array.isArray(list) || !list[id]?.tokens) {
      // Pass all five arguments into fallback
      return fallback(tokens, idx, options, env, self);
    }

    const n = id + 1;
    const defHtml = md.renderer.render(list[id].tokens, options, env).trim();
    const refId = `fn${n}`;

    return `<sup class="annotation-ref${label ? " " + label : ""}">
      <a href="#fn${n}" id="fnref${n}"
         class="annotation-anchor"
         aria-describedby="popup-${refId}">[${n}]</a>
      <span id="popup-${refId}" role="tooltip" class="annotation-popup">${defHtml}</span>
    </sup>`;
  };
}

const inlineMacro = (name, after, toHtml) => md => {
  md.inline.ruler.after(after, name, (state, silent) => {
    const m = state.src.slice(state.pos).match(new RegExp(`^@${name}\\(([^)]+)\\)`));
    if (!m) return false;
    if (!silent) state.push({ type: 'html_inline', content: toHtml(m[1]) });
    state.pos += m[0].length;
    return true;
  });
};
const audioEmbed = inlineMacro('audio', 'emphasis', src => `<audio controls class="audio-embed" src="${src}"></audio>`);
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
      let raw; try { raw = fs.readFileSync(p,'utf8'); } catch { raw = `Error loading ${p}`; }
      return { url:page.url, fileSlug:page.fileSlug, inputContent:raw, data:{ title:page.data?.title||'', aliases:page.data?.aliases||[] } };
    }).filter(Boolean));
  }
};

/* ── Collections / paths ───────────────────────────────────────────────────── */

const baseContent = 'src/content';
const areas = ['sparks','concepts','projects','meta'];
const glob = d => `${baseContent}/${d}/**/*.md`;

/* ── Shortcodes ────────────────────────────────────────────────────────────── */

function specnote(variant, content, tooltip) {
  const cls = { soft:'spec-note-soft', subtle:'spec-note-subtle', liminal:'spec-note-liminal', archival:'spec-note-archival', ghost:'spec-note-ghost' }[variant] || 'spec-note-soft';
  return `<span class="${cls}" title="${tooltip?.replace(/"/g,'&quot;')||''}">${content}</span>`;
}

/* ── Eleventy config ───────────────────────────────────────────────────────── */

module.exports = function(eleventyConfig) {
  [
    [ interlinker, { defaultLayout:'layouts/embed.njk', resolvingFns:new Map([['default', link=>{ const href=link.href||link.link; const label=link.title||link.name; return `<a class="interlink" href="${href}">${label}</a>` }]]) } ],
    [ navigation ],
    [ tailwind, { input:'assets/css/tailwind.css', output:'assets/main.css', minify:true } ]
  ].forEach(([plugin, opts={}] ) => eleventyConfig.addPlugin(plugin, opts));

  eleventyConfig.amendLibrary('md', md => {
    md.use(markdownItFootnote);
    md.use(markdownItAttrs);
    md.core.ruler.disable('footnote_tail');
    mdItExtensions.forEach(fn => fn(md));
    return md;
  });

  Object.entries(filters).forEach(([k,v]) => eleventyConfig.addFilter(k, v));
  areas.forEach(name => eleventyConfig.addCollection(name, api => api.getFilteredByGlob(glob(name))));
  eleventyConfig.addCollection('nodes', api => api.getFilteredByGlob(areas.map(glob)));
  eleventyConfig.addPassthroughCopy('src/assets');
  eleventyConfig.addPassthroughCopy({ 'src/favicon.ico':'favicon.ico' });
  eleventyConfig.setBrowserSyncConfig({ index:'index.html', server:{ baseDir:'_site' } });
  eleventyConfig.addShortcode('specnote', specnote);

  return {
    dir: { input:'src', output:'_site', includes:'_includes', data:'_data' },
    markdownTemplateEngine:'njk',
    htmlTemplateEngine:'njk',
    pathPrefix:'/'
  };
};
