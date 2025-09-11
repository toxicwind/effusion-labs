import register from "./config/register.mjs";
import registerArchive from "./config/archives.mjs";
import { getBuildInfo } from "./config/build-info.js";
import { dirs } from "./config/site.js";
import htmlToMarkdownUnified from "./config/html-to-markdown-unified.mjs";

export default function (eleventyConfig) {
  // Your existing config
  register(eleventyConfig);
  registerArchive(eleventyConfig);

  eleventyConfig.addGlobalData("build", getBuildInfo());
  eleventyConfig.addGlobalData("buildTime", new Date().toISOString());

  // Convert any .html under src/content → Markdown (unified), then let Eleventy treat it like normal .md
  htmlToMarkdownUnified(eleventyConfig, {
    rootDir: "src/content",          // scope: all content HTML
    dumpMarkdownTo: "_cache/md-dumps", // set to null to disable debug dumps
    pageTitlePrefix: "",
    defaultLayout: "layouts/converted-html.njk",               // let directory data decide layout/collections
    frontMatterExtra: { convertedFromHtml: true }
  });

  return {
    dir: dirs,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: false,         // do not template .html (Eleventy defaults HTML→Liquid; disable it)
    templateFormats: ["md", "njk", "html", "11ty.js"],
    pathPrefix: "/"
  };
}
