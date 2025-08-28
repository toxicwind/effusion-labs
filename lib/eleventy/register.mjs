// lib/eleventy/register.mjs
import markdownItFootnote from "markdown-it-footnote";
import markdownItAttrs from "markdown-it-attrs";
import markdownItAnchor from "markdown-it-anchor";
import markdownItShiki from "@shikijs/markdown-it";
import { transformerNotationDiff, transformerNotationHighlight } from "@shikijs/transformers";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import path from "node:path";
import slugify from "slugify";
import { dirs } from "../config.js";
import { icons } from "lucide";

import getPlugins from "../plugins.js";
import filters from "../filters.js";
import { applyMarkdownExtensions } from "../markdown/index.js";
import { specnote } from "../shortcodes.js";
import { CONTENT_AREAS, baseContentPath } from "../constants.js";
import { runPostcssAll } from "../postcss.js";

const glob = (d) => `${baseContentPath}/${d}/**/*.md`;

export default function register(eleventyConfig) {
  const plugins = getPlugins();
  plugins.forEach(([plugin, opts = {}]) => eleventyConfig.addPlugin(plugin, opts));

  if (process.env.ELEVENTY_ENV !== "test") {
    eleventyConfig.ignores.add("test/**");
    eleventyConfig.ignores.add("src/test/**");
  }

  const isTest = process.env.ELEVENTY_ENV === "test";
  const allowImages = process.env.ELEVENTY_TEST_ENABLE_IMAGES === "1";

  // Markdown (Shiki @ build time, footnotes, attrs, anchors)
  eleventyConfig.amendLibrary("md", (md) => {
    md.use(markdownItShiki, {
      themes: { light: "github-light", dark: "github-dark" },
      transformers: [
        {
          pre(node) {
            node.properties.tabindex = 0;
          },
          line(node, i) {
            node.properties["data-line"] = i + 1;
          },
        },
        transformerNotationDiff(),
        transformerNotationHighlight(),
      ],
    });
    md.use(markdownItFootnote);
    md.use(markdownItAttrs);
    md.use(
      markdownItAnchor,
      {
        permalink: markdownItAnchor.permalink.headerLink({
          symbol: "#",
          class: "heading-anchor",
          placement: "before",
        }),
      }
    );
    applyMarkdownExtensions(md);
    return md;
  });

  // Server-side Lucide (for macros like components/icons.njk)
  eleventyConfig.addFilter("lucide", (name, attrs = {}) => {
    const icon = icons[name];
    return icon ? icon.toSvg(attrs) : "";
  });

  // Project filters
  Object.entries(filters).forEach(([key, value]) => {
    eleventyConfig.addFilter(key, value);
  });

  // Content-area collections
  const singular = { sparks: "spark", concepts: "concept", projects: "project", meta: "meta" };
  const workAreas = ["sparks", "concepts", "projects", "meta"];

  CONTENT_AREAS.forEach((name) => {
    eleventyConfig.addCollection(name, (api) =>
      api
        .getFilteredByGlob(glob(name))
        .sort((a, b) => b.date - a.date)
        .map((page) => {
          page.data.type = singular[name];
          return page;
        })
    );
  });

  eleventyConfig.addCollection("work", (api) =>
    workAreas
      .flatMap((name) =>
        api.getFilteredByGlob(glob(name)).map((page) => ({
          url: page.url,
          data: page.data,
          date: page.date,
          type: singular[name],
        }))
      )
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("nodes", (api) =>
    api
      .getFilteredByGlob(CONTENT_AREAS.map(glob))
      .map((page) => {
        const type = singular[CONTENT_AREAS.find((a) => page.inputPath.includes(a))];
        if (type) page.data.type = type;
        return page;
      })
      .sort((a, b) => b.date - a.date)
  );

  // Images
  if (!isTest || allowImages) {
    eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
      urlPath: "/assets/images/",
      outputDir: path.join(dirs.output, "assets/images/"),
      formats: ["avif", "webp", "auto"],
      widths: [320, 640, 960, 1200, 1800, "auto"],
      htmlOptions: {
        imgAttributes: { loading: "lazy", decoding: "async" },
        pictureAttributes: {},
      },
      filenameFormat: (id, src, width, format) => {
        const { name } = path.parse(src);
        const s = slugify(name, { lower: true, strict: true });
        return `${s}-${width}.${format}`;
      },
    });
  }

  // Assets & watches
  eleventyConfig.addPassthroughCopy({ "src/scripts": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "src/assets/static": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icons": "assets/icons" });
  eleventyConfig.addWatchTarget("src/styles");
  eleventyConfig.addWatchTarget("src/assets/static");
  eleventyConfig.addWatchTarget("tailwind.config.mjs");
  eleventyConfig.addWatchTarget("postcss.config.mjs");

  eleventyConfig.setBrowserSyncConfig({
    index: "index.html",
    server: { baseDir: "_site" },
  });

  eleventyConfig.addShortcode("specnote", specnote);

  if (!isTest) {
    eleventyConfig.on("eleventy.before", async () => {
      console.log("🚀 Eleventy build starting with enhanced footnote system...");
      await runPostcssAll([
        { src: "src/styles/app.tailwind.css", dest: "src/assets/css/app.css" },
        { src: "src/styles/mschf-overlay.css", dest: "src/assets/css/mschf-overlay.css" },
      ]);
    });
    eleventyConfig.on("eleventy.after", ({ results }) => {
      console.log(`✅ Eleventy build completed. Generated ${results.length} files.`);
    });
  }
}
