const fs = require("fs");
const { DateTime } = require("luxon");

const interlinker = require("@photogabble/eleventy-plugin-interlinker");
const navigation = require("@11ty/eleventy-navigation");
const tailwind = require("eleventy-plugin-tailwindcss-4");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItAttrs = require("markdown-it-attrs");

/* ── Markdown extensions ───────────────────────────────────────────────────── */

function footnotePopover(md) {
  md.renderer.rules.footnote_ref = (tokens, idx, options, env, self) => {
    const { id, label = "" } = tokens[idx].meta;
    const n = id + 1;
    const defHtml = md.renderer.render(env.footnotes.list[id].tokens, options, env).trim();
    const refId = `fn${n}`;
    return `<sup class="annotation-ref relative group${label ? " " + label : ""}"><a href="#fn${n}" id="fnref${n}" class="annotation-anchor px-1 text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 decoration-dotted" aria-describedby="popup-${refId}">[${n}]</a><span id="popup-${refId}" role="tooltip" class="annotation-popup group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition pointer-events-none opacity-0 absolute left-1/2 z-50 max-w-xs -translate-x-1/2 top-7 bg-white/95 border border-gray-200 shadow-xl rounded-xl p-4 text-sm text-gray-900">${defHtml}</span></sup>`;
  };
}

const inlineMacro = (name, after, toHtml) => md => {
  md.inline.ruler.after(after, name, (state, silent) => {
    const m = state.src.slice(state.pos).match(new RegExp(`^@${name}\\(([^)]+)\\)`));
    if (!m) return false;
    if (!silent) state.push({ type: "html_inline", content: toHtml(m[1]) });
    state.pos += m[0].length;
    return true;
  });
};

const audioEmbed  = inlineMacro("audio", "emphasis", src => `<audio controls class="audio-embed" src="${src}"></audio>`);
const qrEmbed     = inlineMacro("qr", "audio", s => {
  const src = encodeURIComponent(s);
  return `<img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${src}" alt="QR code">`;
});

function externalLinks(md) {
  const base = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (t, i, o, e, s) => {
    t[i].attrJoin("class", "external-link");
    const nxt = t[i + 1];
    if (nxt?.type === "text") nxt.content = "↗ source";
    return base(t, i, o, e, s);
  };
}

const mdItExtensions = [footnotePopover, audioEmbed, qrEmbed, externalLinks];

/* ── Filters ───────────────────────────────────────────────────────────────── */

const ord = n => (n % 100 >= 11 && n % 100 <= 13) ? "th" : (["th", "st", "nd", "rd"][n % 10] || "th");

const filters = {
  readableDate: (d, zone = "utc") => {
    if (!(d instanceof Date)) return "";
    const dt = DateTime.fromJSDate(d, { zone });
    const day = dt.day;
    return `${dt.toFormat("MMMM d")}${ord(day)}, ${dt.toFormat("yyyy")}`;
  },
  htmlDateString: d =>
    d instanceof Date ? DateTime.fromJSDate(d, { zone: "utc" }).toFormat("yyyy-MM-dd") : "",
  limit: (arr = [], n = 5) => Array.isArray(arr) ? arr.slice(0, n) : [],
  jsonify: data => {
    if (!Array.isArray(data)) return "[]";
    const out = data.map(page => {
      const p = page?.inputPath;
      if (!p) return null;
      let raw;
      try { raw = fs.readFileSync(p, "utf8"); }
      catch { raw = `Error loading ${p}`; }
      return {
        url: page.url,
        fileSlug: page.fileSlug,
        inputContent: raw,
        data: { title: page.data?.title || "", aliases: page.data?.aliases || [] }
      };
    }).filter(Boolean);
    return JSON.stringify(out);
  }
};

/* ── Collections / paths ───────────────────────────────────────────────────── */

const baseContent = "src/content";
const areas = ["sparks", "concepts", "projects", "meta"];
const glob = d => `${baseContent}/${d}/**/*.md`;

/* ── Shortcodes ────────────────────────────────────────────────────────────── */

function specnote(variant, content, tooltip) {
  const cls = {
    soft: "spec-note-soft",
    subtle: "spec-note-subtle",
    liminal: "spec-note-liminal",
    archival: "spec-note-archival",
    ghost: "spec-note-ghost"
  }[variant] || "spec-note-soft";
  const tip = tooltip ? tooltip.replace(/"/g, "&quot;") : "";
  return `<span class="${cls}" title="${tip}">${content}</span>`;
}

/* ── Eleventy config ───────────────────────────────────────────────────────── */

module.exports = function (eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(interlinker, {
    defaultLayout: "layouts/embed.njk",
    resolvingFns: new Map([
      ["default", link => {
        const href = link.href || link.link;
        const label = link.title || link.name;
        return `<a class="interlink" href="${href}">${label}</a>`;
      }]
    ])
  });
  eleventyConfig.addPlugin(navigation);
  eleventyConfig.addPlugin(tailwind, { input: "assets/css/tailwind.css", output: "assets/main.css", minify: true });

  // Markdown library
  eleventyConfig.amendLibrary("md", md => {
    md.use(markdownItFootnote);
    md.use(markdownItAttrs);
    mdItExtensions.forEach(fn => fn(md));
    return md;
  });

  // Filters
  Object.entries(filters).forEach(([k, v]) => eleventyConfig.addFilter(k, v));

  // Collections
  areas.forEach(name => eleventyConfig.addCollection(name, api => api.getFilteredByGlob(glob(name))));
  eleventyConfig.addCollection("nodes", api => api.getFilteredByGlob(areas.map(glob)));

  // Assets / server
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.setBrowserSyncConfig({ index: "index.html", server: { baseDir: "_site" } });

  // Shortcodes
  eleventyConfig.addShortcode("specnote", specnote);

  // Output
  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/"
  };
};
