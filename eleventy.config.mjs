// eleventy.config.mjs (root)
import register from "./lib/eleventy/register.mjs";
import { dirs } from "./lib/config.js";
import seeded from "./lib/seeded.js";
import registerArchive from "./lib/eleventy/archives.mjs";
import { getBuildInfo } from "./lib/build-info.js";

// tiny local slugger (keeps filters resilient)
const slug = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function (eleventyConfig) {
  const buildTime = new Date().toISOString();

  // Core project wiring (markdown, assets, images, etc.)
  register(eleventyConfig);

  // 🔐 Load JSON archives → stable collections + helpers
  // Exposes: collections.archiveProducts / archiveCharacters / archiveSeries
  // and filters: byLine, byCompany, byLocale, uniqueBy (+ global archiveCompanies, archiveLines)
  registerArchive(eleventyConfig);

  // ---- Site-specific collections (unchanged semantics) ----
  eleventyConfig.addCollection("featured", (api) =>
    api.getAll().filter((p) => p.data?.featured === true).sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("interactive", (api) =>
    api
      .getAll()
      .filter((p) => {
        const tags = p.data.tags || [];
        return tags.includes("prototype") || p.data.interactive === true;
      })
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("recentAll", (api) => {
    const items = api.getAll().filter((p) => p.data.type);
    items.sort((a, b) => b.date - a.date);
    items.take = (n) => items.slice(0, n);
    return items;
  });

  // ---- Filters that play nicely with archive data ----
  // Match products by character (accepts name or slug)
  eleventyConfig.addFilter("byCharacter", (items, id) => {
    const target = slug(id);
    return (items ?? []).filter((p) => slug(p?.data?.charSlug ?? p?.data?.character) === target);
  });

  // Match products by series (accepts title or slug)
  eleventyConfig.addFilter("bySeries", (items, id) => {
    const target = slug(id);
    return (items ?? []).filter((p) => slug(p?.data?.seriesSlug ?? p?.data?.series) === target);
  });

  // Sort helpers (non-mutating)
  eleventyConfig.addFilter("sortByReleaseDate", (items, dir = "asc") => {
    const arr = [...(items ?? [])];
    arr.sort((a, b) =>
      String(a?.data?.release_date ?? "").localeCompare(String(b?.data?.release_date ?? ""))
    );
    return dir === "desc" ? arr.reverse() : arr;
  });

  eleventyConfig.addFilter("seededShuffle", (arr, seed) => seeded.seededShuffle(arr, seed));

  // ---- Global data ----
  eleventyConfig.addGlobalData("buildTime", buildTime);
  eleventyConfig.addGlobalData("dailySeed", seeded.dailySeed);
  eleventyConfig.addGlobalData("homepageCaps", {
    featured: 3,
    today: 3,
    tryNow: [1, 3],
    pathways: 3,
    questions: 3,
    notebook: 3,
  });
  const build = getBuildInfo();
  eleventyConfig.addGlobalData("build", build);
  return {
    dir: dirs,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/",
  };
}
