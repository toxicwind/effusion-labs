// eleventy.config.mjs
import register from "./config/register.mjs";
import registerArchive from "./config/archives.mjs";
import { getBuildInfo } from "./config/build-info.js";
import { dirs } from "./config/site.js";

export default function (eleventyConfig) {
  // Load core configurations (plugins, markdown, assets, etc.)
  register(eleventyConfig);

  // Load the JSON archive data system
  registerArchive(eleventyConfig);

  // Add global data
  eleventyConfig.addGlobalData("build", getBuildInfo());
  eleventyConfig.addGlobalData("buildTime", new Date().toISOString());

  // Return the final directory structure and template engine settings
  return {
    dir: dirs,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html", "11ty.js"],
    pathPrefix: "/",
  };
}
