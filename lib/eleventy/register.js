const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');

const getPlugins = require('../plugins');
const filters = require('../filters');
const { applyMarkdownExtensions } = require('../markdown');
const { specnote } = require('../shortcodes');
const { CONTENT_AREAS, baseContentPath } = require('../constants');
const runPostcss = require('../postcss');

const glob = d => `${baseContentPath}/${d}/**/*.md`;

/**
 * Register plugins, filters and other behaviour on the given Eleventy config.
 * @param {import('@11ty/eleventy/src/EleventyConfig')} eleventyConfig
 */
module.exports = function register(eleventyConfig) {
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

  eleventyConfig.addPassthroughCopy({ 'src/scripts': 'assets/js' });
  eleventyConfig.addPassthroughCopy({ 'src/favicon.ico': 'favicon.ico' });
  eleventyConfig.addPassthroughCopy({
    'node_modules/lucide/dist/umd/lucide.min.js': 'assets/js/lucide.min.js'
  });

  eleventyConfig.setBrowserSyncConfig({
    index: 'index.html',
    server: { baseDir: '_site' }
  });

  eleventyConfig.addShortcode('specnote', specnote);

  eleventyConfig.on('eleventy.before', async () => {
    console.log('🚀 Eleventy build starting with enhanced footnote system...');
    await runPostcss('src/styles/app.tailwind.css', '_site/assets/css/app.css');
  });
  eleventyConfig.on('eleventy.after', ({ results }) => {
    console.log(`✅ Eleventy build completed. Generated ${results.length} files.`);
  });
};
