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
  const interlinkerOptions = {
    defaultLayout: 'layouts/embed.njk',
    // Disable dead link console noise for templated references
    deadLinkReport: 'none',
    resolvingFns: new Map([
      ['default', link => {
        const href = link.href || link.link;
        const label = link.title || link.name;
        return `<a class="interlink" href="${href}">${label}</a>`;
      }]
    ])
  };

  return [
    [interlinker, interlinkerOptions],
    [navigation],
    [syntaxHighlight, { preAttributes: { tabindex: 0 } }],
    [rss],
    // Tailwind compilation handled via PostCSS pipeline
    [sitemap, { sitemap: { hostname: 'https://effusionlabs.com' } }]
  ];
}

module.exports = getPlugins;
