const interlinker = require('@photogabble/eleventy-plugin-interlinker');
const navigation = require('@11ty/eleventy-navigation');
const tailwind = require('eleventy-plugin-tailwindcss-4');
const rss = require('@11ty/eleventy-plugin-rss');
const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');
const sitemap = require('@quasibit/eleventy-plugin-sitemap');

/**
 * Return the plugin configuration list for Eleventy.
 * Each item is `[plugin, options]`.
 */
function getPlugins() {
  return [
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
    [navigation],
    [syntaxHighlight, { preAttributes: { tabindex: 0 } }],
    [rss],
    [
      tailwind,
      {
        input: 'assets/css/tailwind.css',
        output: 'assets/main.css',
        minify: true
      }
    ],
    [sitemap, { sitemap: { hostname: 'https://effusionlabs.com' } }]
  ];
}

module.exports = getPlugins;
