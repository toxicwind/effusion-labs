const interlinker = require('@photogabble/eleventy-plugin-interlinker');
const navigation = require('@11ty/eleventy-navigation');
const tailwind = require('eleventy-plugin-tailwindcss-4');

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
    [
      tailwind,
      {
        input: 'assets/css/tailwind.css',
        output: 'assets/main.css',
        minify: true
      }
    ]
  ];
}

module.exports = getPlugins;
