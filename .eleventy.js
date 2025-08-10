const register = require('./lib/eleventy/register');
const { dirs } = require('./lib/config');
const { dailySeed, seededShuffle } = require('./lib/homepage');

module.exports = function(eleventyConfig) {
  register(eleventyConfig);

  eleventyConfig.addCollection('interactive', api =>
    api.getAll().filter(p => {
      const tags = p.data.tags || [];
      return tags.includes('prototype') || tags.includes('demo') || p.data.interactive === true;
    })
  );

  eleventyConfig.addCollection('recentAll', api => {
    const items = api.getAll().filter(p => p.data.type);
    items.sort((a, b) => b.date - a.date);
    items.take = n => items.slice(0, n);
    return items;
  });

  eleventyConfig.addFilter('seededShuffle', (arr, seed) => seededShuffle(arr, seed));
  eleventyConfig.addGlobalData('dailySeed', dailySeed);

  return {
    dir: dirs,
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    pathPrefix: '/'
  };
};
