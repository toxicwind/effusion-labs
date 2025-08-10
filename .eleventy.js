const register = require("./lib/eleventy/register");
const { dirs } = require("./lib/config");
const { dailySeed, seededShuffle } = require("./lib/homepage");

module.exports = function (eleventyConfig) {
  register(eleventyConfig);

  eleventyConfig.addCollection("interactive", (api) =>
    api.getAll().filter((p) => {
      const tags = p.data.tags || [];
      return (
        tags.includes("prototype") ||
        tags.includes("demo") ||
        p.data.interactive === true
      );
    }),
  );

  eleventyConfig.addCollection("recentAll", (api) => {
    const items = api.getAll().filter((p) => p.data.type);
    items.sort((a, b) => b.date - a.date);
    items.take = (n) => items.slice(0, n);
    return items;
  });

  // POP MART — The Monsters collections
  const monstersBase =
    "content/archives/collectables/designer-toys/pop-mart/the-monsters";
  eleventyConfig.addCollection("monstersProducts", (api) =>
    api.getFilteredByGlob(`${monstersBase}/products/*.json`),
  );
  eleventyConfig.addCollection("monstersSeries", (api) =>
    api.getFilteredByGlob(`${monstersBase}/series/*.json`),
  );
  eleventyConfig.addCollection("monstersCharacters", (api) =>
    api.getFilteredByGlob(`${monstersBase}/characters/*.json`),
  );

  eleventyConfig.addFilter("byCharacter", (items, slug) =>
    items.filter((p) => p.data.character === slug),
  );
  eleventyConfig.addFilter("bySeries", (items, slug) =>
    items.filter((p) => p.data.series === slug),
  );
  eleventyConfig.addFilter("productsSorted", (a, b) => {
    const ad = a.data.release_date || "";
    const bd = b.data.release_date || "";
    return ad.localeCompare(bd);
  });

  eleventyConfig.addFilter("seededShuffle", (arr, seed) =>
    seededShuffle(arr, seed),
  );
  eleventyConfig.addGlobalData("dailySeed", dailySeed);

  return {
    dir: dirs,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/",
  };
};
