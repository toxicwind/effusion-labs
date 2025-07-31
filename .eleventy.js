const register = require('./lib/eleventy/register');


module.exports = function(eleventyConfig) {
  register(eleventyConfig);

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      data: '_data'
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    pathPrefix: '/'
  };
};
