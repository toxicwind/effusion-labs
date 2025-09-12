// config/register.mjs
import path from "node:path";
import slugify from "slugify";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import getPlugins from "./plugins.js";
import { applyMarkdownExtensions } from "./markdown/index.js";
import { addFilters, addShortcodes } from "./templating.js";
import addCustomCollections from "./collections.js";
import { dirs } from "./site.js";
import { flushUnresolved } from "./interlinkers/unresolved-report.mjs";

export default function register(eleventyConfig) {
  // --- Plugins ---
  getPlugins().forEach(([plugin, opts = {}]) => eleventyConfig.addPlugin(plugin, opts));
  eleventyConfig.ignores.add("src/content/docs/vendor/**");
  eleventyConfig.ignores.add("src/content/docs/vendors/**");

  // --- Markdown Engine Customization ---
  eleventyConfig.amendLibrary("md", (md) => {
    eleventyConfig.markdownLibrary = md;
    return applyMarkdownExtensions(md);
  });

  // --- Templating: Filters & Shortcodes ---
  addFilters(eleventyConfig);
  addShortcodes(eleventyConfig);

  // --- Data Collections ---
  addCustomCollections(eleventyConfig);

  // --- Image Processing ---
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    urlPath: "/assets/images/",
    outputDir: path.join(dirs.output, "assets/images/"),
    formats: ["avif", "webp", "auto"],
    widths: [320, 640, 960, 1200, 1800, "auto"],
    filenameFormat: (id, src, width, format) => {
      const { name } = path.parse(src);
      const s = slugify(name, { lower: true, strict: true });
      return `${s}-${width}.${format}`;
    },
  });

  // --- Asset Passthroughs & Watch Targets ---
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "src/assets/static": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icons": "assets/icons" });
  eleventyConfig.addWatchTarget("src/assets/css/");

  // After build: write unresolved report (log-only, no CI fail)
  eleventyConfig.on("eleventy.after", () => {
    try {
      const payload = flushUnresolved();
      console.log(`Interlinker unresolved (logged only): ${payload.count}`);
    } catch (e) {
      console.error(String(e?.message || e));
      // don’t set exitCode; log-only by design
    }
  });
}
