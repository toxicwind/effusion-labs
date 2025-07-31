const register = require('./lib/eleventy/register');
const { dirs } = require('./lib/config');


module.exports = function(eleventyConfig) {
  register(eleventyConfig);

  return {
    dir: dirs,
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    pathPrefix: '/'
  };
};
