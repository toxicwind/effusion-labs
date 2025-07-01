/* ───────────────────────────────  core requires  ─────────────────────────── */
const path        = require("path");
const fs          = require("fs");
const { DateTime } = require("luxon");

/* plugins */
const interlinker = require("@photogabble/eleventy-plugin-interlinker");
const navigation  = require("@11ty/eleventy-navigation");
const tailwind    = require("eleventy-plugin-tailwindcss-4");

/* ───────────────────────────  main configuration  ────────────────────────── */
module.exports = function (eleventyConfig) {

  /* ░░ Plugins ░░ */
  eleventyConfig.addPlugin(interlinker, { defaultLayout: "layouts/embed.njk" });
  eleventyConfig.addPlugin(navigation);
  eleventyConfig.addPlugin(tailwind, {
    /* the file you created earlier -- src/assets/css/tailwind.css */
    input : "assets/css/tailwind.css",   // path is relative to dir.input ("src")
    output: "assets/main.css",           // written to _site/assets/main.css
    minify: true
  });

  /* ░░ Filters ░░ */
  /* ░░ Pretty-print, U-S style  →  July 4ᵗʰ 2025  ░░ */
  eleventyConfig.addFilter("readableDate", (d, zone = "utc") => {
    if (!(d instanceof Date)) return "";

    const dt = DateTime.fromJSDate(d, { zone });
    const day = dt.day;
    /* → 1st / 2nd / 3rd / 4th… */
    const ordinal =
      day % 10 == 1 && day % 100 != 11 ? "st" :
      day % 10 == 2 && day % 100 != 12 ? "nd" :
      day % 10 == 3 && day % 100 != 13 ? "rd" : "th";

    return `${dt.toFormat("MMMM d")}${ordinal}, ${dt.toFormat("yyyy")}`;
  });

  /* ░░ Machine string, still U-S order  →  07-04-2025  ░░ */
  eleventyConfig.addFilter("htmlDateString", d =>
    d instanceof Date
      ? DateTime.fromJSDate(d, { zone: "utc" }).toFormat("MM-dd-yyyy")
      : ""
  );


  eleventyConfig.addFilter("limit", (arr = [], n = 5) =>
    Array.isArray(arr) ? arr.slice(0, n) : []
  );

  /* stringify page list for JS-fronted graphs, avoids circular refs */
  eleventyConfig.addFilter("jsonify", data => {
    if (!Array.isArray(data)) return "[]";

    const safe = data.map(page => {
      if (!page?.inputPath) return null;

      let raw = "";
      try { raw = fs.readFileSync(page.inputPath, "utf8"); }
      catch { raw = `Error loading ${page.inputPath}`; }

      return {
        url        : page.url,
        fileSlug   : page.fileSlug,
        inputContent: raw,
        data       : {
          title  : page.data?.title   || "",
          aliases: page.data?.aliases || []
        }
      };
    }).filter(Boolean);

    return JSON.stringify(safe);
  });

  /* ░░ Collections ░░ */
  const baseContent = "src/content";
  const glob = dir => `${baseContent}/${dir}/**/*.md`;

  ["sparks", "concepts", "projects", "meta"].forEach(name =>
    eleventyConfig.addCollection(name, api => api.getFilteredByGlob(glob(name)))
  );

  /* composite graph for map-view */
  eleventyConfig.addCollection("nodes", api =>
    api.getFilteredByGlob([
      glob("sparks"),
      glob("concepts"),
      glob("projects"),
      glob("meta")
    ])
  );

  /* ░░ Static assets ░░ */
  eleventyConfig.addPassthroughCopy("src/assets");

  /* ░░ Dev-server tweaks ░░ */
  eleventyConfig.setBrowserSyncConfig({
    index : "index.html",
    server: { baseDir: "_site" }
  });

  /* ░░ Return directory & engine settings ░░ */
  return {
    dir: {
      input   : "src",
      output  : "_site",
      includes: "_includes",
      data    : "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine    : "njk",
    pathPrefix            : "/"
  };
};
