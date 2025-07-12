/* ───────────────────────────────  core requires  ─────────────────────────── */
const path        = require("path");
const fs          = require("fs");
const { DateTime } = require("luxon");

/* ────────────────────────────────  plugins  ─────────────────────────────── */
const interlinker = require("@photogabble/eleventy-plugin-interlinker");
const navigation  = require("@11ty/eleventy-navigation");
const tailwind    = require("eleventy-plugin-tailwindcss-4");

/* ──────────────────────────────  plugin options  ────────────────────────── */
const interlinkerOptions = {
  defaultLayout: "layouts/embed.njk",
  resolvingFns: new Map([
    [
      "default",
      (link, currentPage, il) => {
        const html = il.defaultResolver(link, currentPage);
        return html.replace(/^<a /, '<a class="interlink" ');
      }
    ]
  ])
};

/* ──────────────────────────  markdown-it extras  ────────────────────────── */
const markdownIt         = require("markdown-it");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItAttrs    = require("markdown-it-attrs");

/* ────────────────────────  main configuration  ──────────────────────────── */
module.exports = function(eleventyConfig) {

  /* ░░ PLUGINS ░░ */
  eleventyConfig.addPlugin(interlinker, interlinkerOptions);
  eleventyConfig.addPlugin(navigation);
  eleventyConfig.addPlugin(tailwind, {
    input : "assets/css/tailwind.css",
    output: "assets/main.css",
    minify: true
  });

  /* ░░ MARKDOWN-IT: Footnotes, Attrs, Audio/QR, Auto-Link Prefixing ░░ */
  eleventyConfig.amendLibrary("md", mdLib => {
    mdLib
      .use(markdownItFootnote)
      .use(markdownItAttrs)
      // @audio(src)
      .use(md => {
        md.inline.ruler.after("emphasis", "audio", (state, silent) => {
          const match = state.src.slice(state.pos).match(/^@audio\(([^)]+)\)/);
          if (!match) return false;
          if (!silent) {
            state.push({
              type: "html_inline",
              content: `<audio controls class="audio-embed" src="${match[1]}"></audio>`
            });
          }
          state.pos += match[0].length;
          return true;
        });
      })
      // @qr(url)
      .use(md => {
        md.inline.ruler.after("audio", "qr", (state, silent) => {
          const match = state.src.slice(state.pos).match(/^@qr\(([^)]+)\)/);
          if (!match) return false;
          if (!silent) {
            const src = encodeURIComponent(match[1]);
            state.push({
              type: "html_inline",
              content: `<img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${src}" alt="QR code">`
            });
          }
          state.pos += match[0].length;
          return true;
        });
      });
    // Auto-link prefixing for external links
    const defaultRender = mdLib.renderer.rules.link_open || function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
    mdLib.renderer.rules.link_open = function(tokens, idx, options, env, self) {
      const token = tokens[idx];
      token.attrJoin("class", "external-link");
      const nextToken = tokens[idx + 1];
      // Always replace link text with "↗ source" regardless of original content
      if (nextToken && nextToken.type === "text") {
        nextToken.content = "↗ source";
      }
      return defaultRender(tokens, idx, options, env, self);
    };
    return mdLib;
  });

  /* ░░ FILTERS ░░ */
  eleventyConfig.addFilter("readableDate", (d, zone = "utc") => {
    if (!(d instanceof Date)) return "";
    const dt = DateTime.fromJSDate(d, { zone });
    const day = dt.day;
    const ordinal =
      day % 10 == 1 && day % 100 != 11 ? "st" :
      day % 10 == 2 && day % 100 != 12 ? "nd" :
      day % 10 == 3 && day % 100 != 13 ? "rd" : "th";
    return `${dt.toFormat("MMMM d")}${ordinal}, ${dt.toFormat("yyyy")}`;
  });

  eleventyConfig.addFilter("htmlDateString", d =>
    d instanceof Date
      ? DateTime.fromJSDate(d, { zone: "utc" }).toFormat("yyyy-MM-dd")
      : ""
  );

  eleventyConfig.addFilter("limit", (arr = [], n = 5) =>
    Array.isArray(arr) ? arr.slice(0, n) : []
  );

  eleventyConfig.addFilter("jsonify", data => {
    if (!Array.isArray(data)) return "[]";
    const safe = data
      .map(page => {
        if (!page?.inputPath) return null;
        let raw;
        try {
          raw = fs.readFileSync(page.inputPath, "utf8");
        } catch {
          raw = `Error loading ${page.inputPath}`;
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
      .filter(Boolean);
    return JSON.stringify(safe);
  });

  /* ░░ COLLECTIONS ░░ */
  const baseContent = "src/content";
  const glob = dir => `${baseContent}/${dir}/**/*.md`;

  ["sparks", "concepts", "projects", "meta"].forEach(name =>
    eleventyConfig.addCollection(name, api =>
      api.getFilteredByGlob(glob(name))
    )
  );

  eleventyConfig.addCollection("nodes", api =>
    api.getFilteredByGlob([
      glob("sparks"),
      glob("concepts"),
      glob("projects"),
      glob("meta")
    ])
  );

  /* ░░ STATIC ASSETS ░░ */
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });

  /* ░░ DEV-SERVER ░░ */
  eleventyConfig.setBrowserSyncConfig({
    index : "index.html",
    server: { baseDir: "_site" }
  });

  /* ░░ SHORTCODES ░░ */
  eleventyConfig.addShortcode("specnote", (variant, content, tooltip) => {
    const variants = {
      soft: "spec-note-soft",
      subtle: "spec-note-subtle",
      liminal: "spec-note-liminal",
      archival: "spec-note-archival",
      ghost: "spec-note-ghost"
    };
    const safeClass = variants[variant] || "spec-note-soft";
    const safeTooltip = tooltip ? tooltip.replace(/"/g, "&quot;") : "";
    return `<span class="${safeClass}" title="${safeTooltip}">${content}</span>`;
  });

  /* ░░ DIR & ENGINES ░░ */
  return {
    dir: {
      input:    "src",
      output:   "_site",
      includes: "_includes",
      data:     "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine:     "njk",
    pathPrefix:             "/"
  };
};
