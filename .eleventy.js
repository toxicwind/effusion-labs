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
    "content/collectibles/designer-toys/pop-mart/the-monsters";
  eleventyConfig.addCollection("monstersProducts", (api) =>
    api.getFilteredByGlob(`${monstersBase}/products/*.json`),
  );
  eleventyConfig.addCollection("monstersSeries", (api) =>
    api.getFilteredByGlob(`${monstersBase}/series/*.json`),
  );
  eleventyConfig.addCollection("monstersCharacters", (api) =>
    api.getFilteredByGlob(`${monstersBase}/characters/*.json`),
  );

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
