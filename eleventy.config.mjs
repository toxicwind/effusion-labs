import register from "./config/register.mjs";
import registerArchive from "./config/archives.mjs";
import { getBuildInfo } from "./config/build-info.js";
import { dirs } from "./config/site.js";
import htmlToMarkdownUnified from "./config/html-to-markdown-unified.mjs";

export default function (eleventyConfig) {
  // saner error locations while debugging
  eleventyConfig.setNunjucksEnvironmentOptions({
    trimBlocks: false,
    lstripBlocks: false,
    noCache: true,
    throwOnUndefined: false,
  });

  // ⬅️ Add the ternary filter so rewrites work
  eleventyConfig.addNunjucksFilter("ternary", function (val, a, b) {
    return val ? a : b;
  });

  // your existing config
  register(eleventyConfig);
  registerArchive(eleventyConfig);

  eleventyConfig.addGlobalData("build", getBuildInfo());
  eleventyConfig.addGlobalData("buildTime", new Date().toISOString());

  // Auto-fix {{ X ? A : B }} before each build (can opt-out with FIX_NJK_TERNARY=0)
  eleventyConfig.on("eleventy.before", async () => {
    if (process.env.FIX_NJK_TERNARY === "0") return;
    try {
      // ⬅️ corrected path
      const { fixRepoTernaries } = await import("./utils/scripts/fix-njk-ternaries.mjs");
      const report = await fixRepoTernaries({
        roots: ["src"],
        exts: [".njk", ".md", ".html"],
        dryRun: !!process.env.DRY_RUN,
        logFile: ".njk-fix-report.json",
        quiet: !!process.env.FIX_NJK_QUIET,
      });
      if (!report.quiet && report.modified > 0) {
        console.log(`[njk-fix] patched ${report.modified} file(s); summary → ${report.logFile}`);
      }
    } catch (err) {
      console.error("[njk-fix] failed:", err?.message || err);
    }
  });

  // HTML→Markdown pipeline (unchanged)
  htmlToMarkdownUnified(eleventyConfig, {
    rootDir: "src/content",
    dumpMarkdownTo: "_cache/md-dumps",
    pageTitlePrefix: "",
    defaultLayout: "layouts/converted-html.njk",
    frontMatterExtra: { convertedFromHtml: true },
  });

  return {
    dir: dirs,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: false,
    templateFormats: ["md", "njk", "html", "11ty.js"],
    pathPrefix: "/",
  };
}
