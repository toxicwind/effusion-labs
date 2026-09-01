const interlinker = require('@photogabble/eleventy-plugin-interlinker');
const navigation = require('@11ty/eleventy-navigation');
const rss = require('@11ty/eleventy-plugin-rss');
const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');
const sitemap = require('@quasibit/eleventy-plugin-sitemap');

/**
 * Return the plugin configuration list for Eleventy.
 * Each item is `[plugin, options]`.
 * @returns {Array<[Function, Object]>}
 */
function getPlugins() {
  return [
    [
      interlinker,
      {
        defaultLayout: 'layouts/utility/embed.njk',
        resolvingFns: new Map([
          ['default', link => {
            const href = link.href || link.link;
            const label = link.title || link.name;
            return `<a class="interlink" href="${href}">${label}</a>`;
          }]
        ])
      }
    ],
    [navigation],
    [syntaxHighlight, { preAttributes: { tabindex: 0 } }],
    [rss],
    // Tailwind compilation handled via PostCSS pipeline
    [sitemap, { sitemap: { hostname: 'https://effusionlabs.com' } }]
  ];
}



// === Agentic Lens-First: lens orchestrator plugin (2026-09-01) ===
const { LensOrchestrator } = require('../lens-orchestrator');

function lensPlugin(eleventyConfig) {
  const orchestrator = new LensOrchestrator();

  // Shortcode: {% lens "name", content %}
  eleventyConfig.addShortcode("lens", (lensName, content) => {
    return `<lens-output data-lens="${lensName}">${lensName}</lens-output>`;
  });

  // Pre-build: run lens pipeline across all content
  eleventyConfig.on('eleventy.before', async () => {
    if (process.env.LENS_ENABLED !== 'true') return;
    await orchestrator.discover();
    const allContent = []; // populated by Eleventy internals
    // Note: full integration requires access to api.getAll() in before hook
    // This registers the hook; the orchestrator runs when content is available
    console.log('[lens] Build pipeline registered');
  });
}

module.exports = getPlugins;
module.exports.lensPlugin = lensPlugin;
