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


  // --- Failure box + items ---
  eleventyConfig.addPairedShortcode(
    "failbox",
    function (content, title = "FAILURE MODES WORTH RESPECTING", kicker = "") {
      const safeTitle = this.env.filters.escape(title);
      const safeKicker = kicker ? `<p class="failbox-kicker">${this.env.filters.escape(kicker)}</p>` : "";
      return `
  <aside class="failbox" role="note" aria-labelledby="failbox-title">
    <div class="failbox-head">
      <h3 id="failbox-title" class="failbox-title">${safeTitle}</h3>
      ${safeKicker}
    </div>
    <div class="failbox-body">
      ${content}
    </div>
  </aside>`;
    }
  );

  // Individual item
  eleventyConfig.addPairedShortcode(
    "failitem",
    function (content, label = "") {
      const safeLabel = this.env.filters.escape(label);
      const heading = label
        ? `<div class="failitem-label"><strong>${safeLabel}</strong></div>`
        : "";
      return `
  <section class="failitem">
    ${heading}
    <div class="failitem-content">
      ${content}
    </div>
  </section>`;
    }
  );

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
