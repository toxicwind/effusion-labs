const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');

const getPlugins = require('./lib/plugins');
const filters = require('./lib/filters');
const { mdItExtensions } = require('./lib/markdown');
const { specnote } = require('./lib/shortcodes');
const fs = require('fs');
const postcss = require('postcss');

const baseContent = 'src/content';
const areas = ['sparks','concepts','projects','meta'];
const glob = d => `${baseContent}/${d}/**/*.md`;


module.exports = function(eleventyConfig) {
  const plugins = getPlugins();
  plugins.forEach(([plugin, opts = {}]) => eleventyConfig.addPlugin(plugin, opts));

  eleventyConfig.amendLibrary('md', md => {
    md.use(markdownItFootnote);
    md.use(markdownItAttrs);
    mdItExtensions.forEach(fn => {
      try {
        fn(md);
      } catch (error) {
        console.error(`Error applying markdown extension: ${error.message}`);
      }
    });
    return md;
  });

  Object.entries(filters).forEach(([key, value]) => {
    eleventyConfig.addFilter(key, value);
  });

  areas.forEach(name => {
    eleventyConfig.addCollection(name, api => api.getFilteredByGlob(glob(name)));
  });
  eleventyConfig.addCollection('nodes', api =>
    api.getFilteredByGlob(areas.map(glob))
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

    const inputPath = 'src/assets/css/tailwind.css';
    const outputPath = '_site/assets/css/tailwind.css';
    const css = fs.readFileSync(inputPath, 'utf8');
    const result = await postcss([
      require('@tailwindcss/postcss'),
      require('autoprefixer')
    ]).process(css, { from: inputPath });

    fs.mkdirSync(require('path').dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.css);
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
