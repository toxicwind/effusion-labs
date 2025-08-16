const templatedLinkPlugin = require('./eleventy/templated-link-plugin');
const interlinker = require('@photogabble/eleventy-plugin-interlinker');
const tagNormaliser = require('@photogabble/eleventy-plugin-tag-normaliser');
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
    [templatedLinkPlugin],
    [
      interlinker,
      {
        defaultLayout: 'layouts/embed.njk',
        resolvingFns: new Map([
          ['default', link => {
            const href = link.href || link.link;
            const label = link.title || link.name;
            return `<a class="interlink" href="${href}">${label}</a>`;
          }]
        ])
      }
    ],
    [tagNormaliser],
    [navigation],
    [syntaxHighlight, { preAttributes: { tabindex: 0 } }],
    [rss],
    // Tailwind compilation handled via PostCSS pipeline
    [sitemap, { sitemap: { hostname: 'https://effusionlabs.com' } }]
  ];
}

module.exports = getPlugins;
