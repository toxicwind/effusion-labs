const register = require("./lib/eleventy/register");
const { dirs } = require("./lib/config");
const seeded = require("./lib/seeded");
const registerArchiveCollections = require("./lib/eleventy/archive-collections");

module.exports = function (eleventyConfig) {

  // === Agentic Lens-First: AST pipeline integration (2026-09-01) ===
  const { ASTEngine } = require('./lib/ast-engine');
  const astEngine = new ASTEngine();

  eleventyConfig.on('eleventy.after', async ({ results }) => {
    if (process.env.LENS_ENABLED !== 'true') return;
    console.log('[ast] Running post-build AST annotation pipeline...');
    const allContent = results || [];
    const astManifest = { generated: new Date().toISOString(), items: [] };

    for (const item of allContent) {
      if (!item.content) continue;
      try {
        const { results: lensResults, annotations } = await astEngine.transform(item.content, ['stylometric', 'osint', 'cryptographic', 'semantic']);
        astManifest.items.push({
          path: item.inputPath,
          title: item.data?.title,
          annotations: annotations.slice(0, 50), // cap per file
          topology: annotations.filter(a => a.type === 'heading').map(a => ({
            depth: a.lensResults?.semantic?.depth,
            text: a.lensResults?.semantic?.text
          }))
        });
      } catch (e) {
        console.warn(`[ast] Failed to process ${item.inputPath}: ${e.message}`);
      }
    }

    const outPath = require('path').resolve(__dirname, './src/_data/astManifest.json');
    await require('fs').promises.mkdir(require('path').dirname(outPath), { recursive: true });
    await require('fs').promises.writeFile(outPath, JSON.stringify(astManifest, null, 2));
    console.log(`[ast] Wrote AST manifest: ${outPath}`);
  });

  register(eleventyConfig);

  // === Agentic Lens-First: lens system hooks (2026-09-01) ===
  const { LensOrchestrator } = require('./lib/lens-orchestrator');
  const lensOrchestrator = new LensOrchestrator();

  eleventyConfig.on('eleventy.before', async ({ runMode, outputMode }) => {
    if (process.env.LENS_ENABLED !== 'true') return;
    await lensOrchestrator.discover();
    console.log('[lens] Build pipeline active —', runMode, outputMode);
  });

  eleventyConfig.addShortcode('lens', (lensName, content) => {
    return `<lens-output data-lens="${lensName}" data-timestamp="${Date.now()}">${lensName}</lens-output>`;
  });

  eleventyConfig.ignores.add('src/layouts/**');
  eleventyConfig.ignores.add('src/content/docs/**');
  eleventyConfig.ignores.add('src/content/docs/**/*.html');
  eleventyConfig.ignores.add('src/content/docs/knowledge/**/*.html');
  eleventyConfig.ignores.add('src/content/docs/knowledge/**/*.html.raw');
  eleventyConfig.addTemplateFormats("json");

  eleventyConfig.addCollection("featured", (api) =>
    api.getAll().filter((p) => p.data?.featured === true),
  );

  eleventyConfig.addCollection("interactive", (api) =>
    api.getAll().filter((p) => {
      const tags = p.data.tags || [];
      return tags.includes("prototype") || p.data.interactive === true;
    }),
  );

  eleventyConfig.addCollection("recentAll", (api) => {
    const items = api.getAll().filter((p) => p.data.type);
    items.sort((a, b) => b.date - a.date);
    items.take = (n) => items.slice(0, n);
    return items;
  });

  registerArchiveCollections(eleventyConfig);

  eleventyConfig.addFilter("byCharacter", (items, slug) =>
    items.filter((p) => p.data.character === slug),
  );
  eleventyConfig.addFilter("bySeries", (items, slug) =>
    items.filter((p) => p.data.series === slug),
  );
  eleventyConfig.addFilter("productsSorted", (a, b) => {
    const ad = a.data.release_date || "";
    const bd = b.data.release_date || "";
    return ad.localeCompare(bd);
  });

  eleventyConfig.addFilter("seededShuffle", (arr, seed) =>
    seeded.seededShuffle(arr, seed),
  );
  eleventyConfig.addGlobalData("dailySeed", seeded.dailySeed);
  eleventyConfig.addGlobalData("homepageCaps", {
    featured: 1,
    today: 3,
    tryNow: [1, 3],
    pathways: 3,
    questions: 3,
    notebook: 4,
  });

  return {
    dir: dirs,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/",
  };
};
