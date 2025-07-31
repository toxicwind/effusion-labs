const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');

const getPlugins = require('./lib/plugins');
const filters = require('./lib/filters');
const { applyMarkdownExtensions } = require('./lib/markdown');
const { specnote } = require('./lib/shortcodes');
const { CONTENT_AREAS, baseContentPath } = require('./lib/constants');
const runPostcss = require('./lib/postcss');

const glob = d => `${baseContentPath}/${d}/**/*.md`;


module.exports = function(eleventyConfig) {
  const plugins = getPlugins();
  plugins.forEach(([plugin, opts = {}]) => eleventyConfig.addPlugin(plugin, opts));

  eleventyConfig.amendLibrary('md', md => {
    md.use(markdownItFootnote);
    md.use(markdownItAttrs);
    applyMarkdownExtensions(md);
    return md;
  });

  Object.entries(filters).forEach(([key, value]) => {
    eleventyConfig.addFilter(key, value);
  });

  CONTENT_AREAS.forEach(name => {
    eleventyConfig.addCollection(name, api => api.getFilteredByGlob(glob(name)));
  });
  eleventyConfig.addCollection('nodes', api =>
    api.getFilteredByGlob(CONTENT_AREAS.map(glob))
  );

  // Copy raw Tailwind source for direct inspection
  eleventyConfig.addPassthroughCopy({ 'src/assets/css': 'assets/css' });
  eleventyConfig.addPassthroughCopy({ 'src/favicon.ico': 'favicon.ico' });
  eleventyConfig.addPassthroughCopy({
    'node_modules/lucide/dist/umd/lucide.min.js': 'assets/js/lucide.min.js'
  });

  eleventyConfig.setBrowserSyncConfig({
    index: 'index.html',
    server: { baseDir: '_site' }
  });

  eleventyConfig.addShortcode('specnote', specnote);

  eleventyConfig.on('eleventy.before', () => {
    console.log('🚀 Eleventy build starting with enhanced footnote system...');
  });
  eleventyConfig.on('eleventy.after', async ({ results }) => {
    console.log(`✅ Eleventy build completed. Generated ${results.length} files.`);
    await runPostcss('src/assets/css/tailwind.css', '_site/assets/css/tailwind.css');
  });

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
