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

  // {% lens "semantic" %} — renders live build-time lens analysis for the
  // current page from the lens manifest (tools/lens-manifest.mjs prebuild).
  // Falls back to a pending marker when the manifest has no entry (organism dormant).
  eleventyConfig.addShortcode('lens', function (lensName) {
    const esc = (s) => String(s ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const norm = (p) => String(p || '').replace(/^\.\//, '');
    let manifest = (this.ctx && this.ctx.lensManifest) || this.lensManifest;
    if (!manifest) {
      try {
        const fsSync = require('fs');
        const pathSync = require('path');
        const raw = fsSync.readFileSync(
          pathSync.join(__dirname, 'src', '_data', 'lensManifest.json'), 'utf8');
        manifest = JSON.parse(raw);
      } catch (_) { /* prebuild has not run; fall through to pending */ }
    }
    const inputPath = this.page && this.page.inputPath;
    const items = (manifest && manifest.items) || [];
    const item = items.find((i) =>
      norm(i.path) === norm(inputPath) ||
      norm(inputPath).endsWith(norm(i.path)) ||
      norm(i.path).endsWith(norm(inputPath)));
    const result = item && item.lens_results && item.lens_results[lensName];
    if (!result) {
      return `<lens-output data-lens="${esc(lensName)}" data-status="pending">` +
        `lens &quot;${esc(lensName)}&quot; — analysis pending (run with LENS_ENABLED=true)</lens-output>`;
    }
    const rows = Object.entries(result)
      .filter(([k]) => k !== '_meta')
      .map(([k, v]) => {
        const val = (v !== null && typeof v === 'object') ? JSON.stringify(v) : String(v);
        return `<div class="lens-field"><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`;
      }).join('');
    const conf = result.confidence !== undefined ? ` data-confidence="${esc(result.confidence)}"` : '';
    return `<lens-output data-lens="${esc(lensName)}" data-status="live"${conf}>` +
      `<dl class="lens-result">${rows}</dl></lens-output>`;
  });

  eleventyConfig.ignores.add('src/layouts/**');
  eleventyConfig.ignores.add('src/content/docs/vendors/**');
  eleventyConfig.ignores.add('src/content/docs/vendor/**');
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

  // Nodes: every addressable content item with a title, oldest-first (feed reverses).
  eleventyConfig.addCollection("nodes", (api) => {
    const items = api
      .getAll()
      .filter((p) => p.url && p.data?.title && !p.data?.eleventyExcludeFromCollections);
    items.sort((a, b) => (a.date || 0) - (b.date || 0));
    return items;
  });

  // TagList: { slug, label, items } per non-structural tag, biggest first.
  eleventyConfig.addCollection("tagList", (api) => {
    const { slugify } = require("./lib/filters");
    // Only skip tags that carry no topical meaning. Lane names (projects,
    // concepts, sparks, meta, ...) stay linkable: meta-aside.njk links
    // every tag, so every linked tag must have a page.
    const skip = new Set(["all", "nav", "post", "posts", "node", "nodes"]);
    const map = new Map();
    for (const p of api.getAll()) {
      if (!p.url || p.data?.eleventyExcludeFromCollections) continue;
      const tags = p.data?.tags || [];
      for (const t of tags) {
        const slug = slugify(String(t));
        if (!slug || skip.has(slug)) continue;
        if (!map.has(slug)) map.set(slug, { slug, label: String(t), items: [] });
        map.get(slug).items.push(p);
      }
    }
    return [...map.values()].sort(
      (a, b) => b.items.length - a.items.length || a.slug.localeCompare(b.slug),
    );
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
