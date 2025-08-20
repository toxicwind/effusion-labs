const markdownItFootnote = require('markdown-it-footnote');
const markdownItAttrs = require('markdown-it-attrs');
const markdownItAnchor = require('markdown-it-anchor');
const { eleventyImageTransformPlugin } = require('@11ty/eleventy-img');
const path = require('node:path');
const fs = require('node:fs');
const slugify = require('slugify');
const { dirs } = require('../config');
const { filterDeadLinks } = require('../wikilinks/filter-dead-links');
const cliProgress = require('cli-progress');
const pMap = async (...args) => (await import('p-map')).default(...args);

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

  if (process.env.ELEVENTY_ENV !== 'test') {
    eleventyConfig.ignores.add('test/**');
    eleventyConfig.ignores.add('src/test/**');
  }

  eleventyConfig.on('eleventy.after', async () => {
    const root = process.env.ELEVENTY_ROOT || process.cwd();
    process.env.ELEVENTY_ROOT = root;
    const deadLinksPath = path.join(root, '.dead-links.json');
    if (!fs.existsSync(deadLinksPath)) return;
    const raw = fs.readFileSync(deadLinksPath, 'utf8').trim();
    if (!raw) {
      console.warn('[@photogabble/wikilinks] dead link report generated no data.');
      fs.rmSync(deadLinksPath);
      return;
    }
    const data = JSON.parse(raw);
    const filtered = filterDeadLinks(data);
    const entries = Object.entries(filtered);
    if (entries.length) {
      const bar = new cliProgress.SingleBar({
        format: 'processing dead links {bar} {value}/{total}'
      }, cliProgress.Presets.shades_classic);
      bar.start(entries.length, 0);
      await pMap(
        entries,
        async ([link, files]) => {
          console.warn(
            '[@photogabble/wikilinks] WARNING Wikilink (' +
              link +
              ') found pointing to to non-existent page in:'
          );
          for (const file of files) {
            console.warn(`\t- ${file}`);
          }
          bar.increment();
        },
        { concurrency: 4 }
      );
      bar.stop();
    } else {
      console.log('[@photogabble/wikilinks] No dead links found.');
    }
    fs.rmSync(deadLinksPath);
  });

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
  const workAreas = ['sparks', 'concepts', 'projects', 'meta'];

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

  eleventyConfig.addCollection('work', api =>
    workAreas
      .flatMap(name =>
        api.getFilteredByGlob(glob(name)).map(page => ({
          url: page.url,
          data: page.data,
          date: page.date,
          type: singular[name]
        }))
      )
      .sort((a, b) => b.date - a.date)
  );

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
      outputDir: path.join(dirs.output, 'assets/images/'),
      formats: ['avif', 'webp', 'auto'],
      widths: [320, 640, 960, 1200, 1800, 'auto'],
      htmlOptions: {
        imgAttributes: {
          loading: 'lazy',
          decoding: 'async'
        },
        pictureAttributes: {}
      },
      filenameFormat: (id, src, width, format) => {
        const { name } = path.parse(src);
        const slug = slugify(name, { lower: true, strict: true });
        return `${slug}-${width}.${format}`;
      }
    });
  }

  eleventyConfig.addPassthroughCopy({ 'src/scripts': 'assets/js' });
  eleventyConfig.addPassthroughCopy({ 'src/favicon.ico': 'favicon.ico' });
  eleventyConfig.addPassthroughCopy({
    'node_modules/lucide/dist/umd/lucide.min.js': 'assets/js/lucide.min.js'
  });
  eleventyConfig.addPassthroughCopy({ 'src/assets/static': 'assets' });
  eleventyConfig.addPassthroughCopy({ 'src/assets/css': 'assets/css' });
  eleventyConfig.addWatchTarget('src/styles');
  eleventyConfig.addWatchTarget('src/assets/static');

  eleventyConfig.setBrowserSyncConfig({
    index: 'index.html',
    server: { baseDir: '_site' }
  });

  eleventyConfig.addShortcode('specnote', specnote);

  if (!isTest) {
    eleventyConfig.on('eleventy.before', async () => {
      console.log('🚀 Eleventy build starting with enhanced footnote system...');
      await runPostcss('src/styles/app.tailwind.css', 'src/assets/css/app.css');
    });
    eleventyConfig.on('eleventy.after', ({ results }) => {
      console.log(`✅ Eleventy build completed. Generated ${results.length} files.`);
    });
  }
};
