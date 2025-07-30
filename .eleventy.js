const fs = require("fs");
const { DateTime } = require("luxon");

const interlinker = require("@photogabble/eleventy-plugin-interlinker");
const navigation = require("@11ty/eleventy-navigation");
const tailwind = require("eleventy-plugin-tailwindcss-4");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItAttrs = require("markdown-it-attrs");

/* ── Markdown extensions ───────────────────────────────────────────────────── */

function footnotePopover(md) {
  const defaultRender = md.renderer.rules.footnote_ref
    || ((tokens, idx, options, env, self) => {
         const { id } = tokens[idx].meta;
         const n = id + 1;
         return `<sup class="footnote-ref"><a href="#fn${n}" id="fnref${n}">[${n}]</a></sup>`;
       });

  md.renderer.rules.footnote_ref = (tokens, idx, options, env, self) => {
    const { id, label = "" } = tokens[idx].meta;
    const list = env.footnotes && env.footnotes.list;
    if (!Array.isArray(list) || !list[id] || !Array.isArray(list[id].tokens)) {
      return defaultRender(tokens, idx, options, env, self);
    }
    const n = id + 1;
    const defHtml = md.renderer.render(list[id].tokens, options, env).trim();
    const refId = `fn${n}`;
    return `<sup class="annotation-ref${label ? " " + label : ""}">
      <a href="#fn${n}" id="fnref${n}" class="annotation-anchor"
         aria-describedby="popup-${refId}">[${n}]</a>
      <span id="popup-${refId}" role="tooltip" class="annotation-popup">
        ${defHtml}
      </span>
    </sup>`;
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

const audioEmbed = inlineMacro("audio", "emphasis", src =>
  `<audio controls class="audio-embed" src="${src}"></audio>`
);

const qrEmbed = inlineMacro("qr", "audio", s => {
  const src = encodeURIComponent(s);
  return `<img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${src}" alt="QR code">`;
});

function externalLinks(md) {
  const base = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrJoin("class", "external-link");
    const nxt = tokens[idx + 1];
    if (nxt?.type === "text") nxt.content = "↗ source";
    return base(tokens, idx, options, env, self);
  };
}

const mdItExtensions = [footnotePopover, audioEmbed, qrEmbed, externalLinks];

/* ── Filters ───────────────────────────────────────────────────────────────── */

const ord = n =>
  n % 100 >= 11 && n % 100 <= 13
    ? "th"
    : ["th", "st", "nd", "rd"][n % 10] || "th";

const filters = {
  readableDate: (d, zone = "utc") => {
    if (!(d instanceof Date)) return "";
    const dt = DateTime.fromJSDate(d, { zone });
    return `${dt.toFormat("MMMM d")}${ord(dt.day)}, ${dt.toFormat("yyyy")}`;
  },
  htmlDateString: d =>
    d instanceof Date
      ? DateTime.fromJSDate(d, { zone: "utc" }).toFormat("yyyy-MM-dd")
      : "",
  limit: (arr = [], n = 5) => (Array.isArray(arr) ? arr.slice(0, n) : []),
  jsonify: data => {
    if (!Array.isArray(data)) return "[]";
    return JSON.stringify(
      data
        .map(page => {
          const p = page?.inputPath;
          if (!p) return null;
          let raw;
          try {
            raw = fs.readFileSync(p, "utf8");
          } catch {
            raw = `Error loading ${p}`;
          }
          return {
            url: page.url,
            fileSlug: page.fileSlug,
            inputContent: raw,
            data: {
              title: page.data?.title || "",
              aliases: page.data?.aliases || []
            }
          };
        })
        .filter(Boolean)
    );
  }
};

/* ── Collections / paths ───────────────────────────────────────────────────── */

const baseContent = "src/content";
const areas = ["sparks", "concepts", "projects", "meta"];
const glob = d => `${baseContent}/${d}/**/*.md`;

/* ── Shortcodes ────────────────────────────────────────────────────────────── */

function specnote(variant, content, tooltip) {
  const clsmap = {
    soft: "spec-note-soft",
    subtle: "spec-note-subtle",
    liminal: "spec-note-liminal",
    archival: "spec-note-archival",
    ghost: "spec-note-ghost"
  };
  const cls = clsmap[variant] || clsmap.soft;
  const tip = tooltip ? tooltip.replace(/"/g, "&quot;") : "";
  return `<span class="${cls}" title="${tip}">${content}</span>`;
}

/* ── Eleventy config ───────────────────────────────────────────────────────── */

module.exports = function (eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(interlinker, {
    defaultLayout: "layouts/embed.njk",
    resolvingFns: new Map([
      [
        "default",
        link => {
          const href = link.href || link.link;
          const label = link.title || link.name;
          return `<a class="interlink" href="${href}">${label}</a>`;
        }
      ]
    ])
  });
  eleventyConfig.addPlugin(navigation);
  eleventyConfig.addPlugin(tailwind, {
    input: "assets/css/tailwind.css",
    output: "assets/main.css",
    minify: true
  });

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
  areas.forEach(name =>
    eleventyConfig.addCollection(name, api => api.getFilteredByGlob(glob(name)))
  );
  eleventyConfig.addCollection("nodes", api =>
    api.getFilteredByGlob(areas.map(glob))
  );

  // Assets / server
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.setBrowserSyncConfig({
    index: "index.html",
    server: { baseDir: "_site" }
  });

  // Shortcodes
  eleventyConfig.addShortcode("specnote", specnote);

  // Output config
  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/"
  };
};
