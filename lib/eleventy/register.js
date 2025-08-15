const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');
const markdownItAnchor = require('markdown-it-anchor');
const { eleventyImageTransformPlugin } = require('@11ty/eleventy-img');

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

  const isTest = process.env.ELEVENTY_ENV === 'test';
  const allowImages = process.env.ELEVENTY_TEST_ENABLE_IMAGES === '1';

  eleventyConfig.amendLibrary('md', md => {
    md.use(markdownItFootnote);
    md.use(markdownItAttrs);
    const anchorOpts = {
      permalink: markdownItAnchor.permalink.headerLink({
        symbol: '#',
        class: 'heading-anchor',
        placement: 'before'
      })
    };
    md.use(markdownItAnchor, anchorOpts);
    applyMarkdownExtensions(md);
    return md;
  });

  Object.entries(filters).forEach(([key, value]) => {
    eleventyConfig.addFilter(key, value);
  });

  const singular = { sparks: 'spark', concepts: 'concept', projects: 'project', meta: 'meta' };

  CONTENT_AREAS.forEach(name => {
    eleventyConfig.addCollection(name, api =>
      api
        .getFilteredByGlob(glob(name))
        .sort((a, b) => b.date - a.date)
        .map(page => {
          page.data.type = singular[name];
          return page;
        })
    );
  });

  eleventyConfig.addCollection('nodes', api =>
    api
      .getFilteredByGlob(CONTENT_AREAS.map(glob))
      .map(page => {
        const type = singular[CONTENT_AREAS.find(a => page.inputPath.includes(a))];
        if (type) page.data.type = type;
        return page;
      })
      .sort((a, b) => b.date - a.date)
  );

  if (!isTest || allowImages) {
    eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
      urlPath: '/assets/images/',
      outputDir: '_site/assets/images/',
      formats: ['avif', 'webp', 'auto'],
      widths: [320, 640, 960, 1200, 1800, 'auto'],
      htmlOptions: {
        imgAttributes: {
          loading: 'lazy',
          decoding: 'async'
        },
        pictureAttributes: {}
      }
    });
  }

  eleventyConfig.addPassthroughCopy({ 'src/scripts': 'assets/js' });
  eleventyConfig.addPassthroughCopy({ 'src/favicon.ico': 'favicon.ico' });
  eleventyConfig.addPassthroughCopy({
    'node_modules/lucide/dist/umd/lucide.min.js': 'assets/js/lucide.min.js'
  });
  eleventyConfig.addPassthroughCopy({ 'src/assets/static': 'assets' });
  eleventyConfig.addWatchTarget('src/assets/static');

  eleventyConfig.setBrowserSyncConfig({
    index: 'index.html',
    server: { baseDir: '_site' }
  });

  eleventyConfig.addShortcode('specnote', specnote);

  if (!isTest) {
    eleventyConfig.on('eleventy.before', async () => {
      console.log('🚀 Eleventy build starting with enhanced footnote system...');
      await runPostcss('src/styles/app.tailwind.css', '_site/assets/css/app.css');
    });
    eleventyConfig.on('eleventy.after', ({ results }) => {
      console.log(`✅ Eleventy build completed. Generated ${results.length} files.`);
    });
  }
};
