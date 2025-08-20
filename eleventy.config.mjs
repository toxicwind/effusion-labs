import register from './lib/eleventy/register.mjs';
import { dirs } from './lib/config.js';
import seeded from './lib/seeded.js';
import registerArchiveCollections from './lib/eleventy/archive-collections.js';
import { getBuildInfo } from './lib/build-info.js';

export default function (eleventyConfig) {
  const buildTime = new Date().toISOString();
  register(eleventyConfig);
  eleventyConfig.addTemplateFormats('json');

  eleventyConfig.addCollection('featured', (api) =>
    api
      .getAll()
      .filter((p) => p.data?.featured === true)
      .sort((a, b) => b.date - a.date),
  );

  eleventyConfig.addCollection('interactive', (api) =>
    api
      .getAll()
      .filter((p) => {
        const tags = p.data.tags || [];
        return tags.includes('prototype') || p.data.interactive === true;
      })
      .sort((a, b) => b.date - a.date),
  );

  eleventyConfig.addCollection('recentAll', (api) => {
    const items = api.getAll().filter((p) => p.data.type);
    items.sort((a, b) => b.date - a.date);
    items.take = (n) => items.slice(0, n);
    return items;
  });

  registerArchiveCollections(eleventyConfig);

  eleventyConfig.addFilter('byCharacter', (items, slug) =>
    items.filter((p) => p.data.character === slug),
  );
  eleventyConfig.addFilter('bySeries', (items, slug) =>
    items.filter((p) => p.data.series === slug),
  );
  eleventyConfig.addFilter('productsSorted', (a, b) => {
    const ad = a.data.release_date || '';
    const bd = b.data.release_date || '';
    return ad.localeCompare(bd);
  });

  eleventyConfig.addFilter('seededShuffle', (arr, seed) =>
    seeded.seededShuffle(arr, seed),
  );
  eleventyConfig.addGlobalData('buildTime', buildTime);
  eleventyConfig.addGlobalData('dailySeed', seeded.dailySeed);
  eleventyConfig.addGlobalData('homepageCaps', {
    featured: 3,
    today: 3,
    tryNow: [1, 3],
    pathways: 3,
    questions: 3,
    notebook: 3,
  });
  const build = getBuildInfo();
  eleventyConfig.addGlobalData('build', build);

  return {
    dir: dirs,
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    pathPrefix: '/',
  };
}
