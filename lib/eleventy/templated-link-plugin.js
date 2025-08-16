const { removeTemplatedLinks } = require('../templated-link-filter');

module.exports = function(eleventyConfig) {
  eleventyConfig.addTransform('templated-link-filter', (content) => removeTemplatedLinks(content));
};
