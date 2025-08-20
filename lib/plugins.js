import interlinker from '@photogabble/eleventy-plugin-interlinker';
import navigation from '@11ty/eleventy-navigation';
import rss from '@11ty/eleventy-plugin-rss';
import syntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';
import sitemap from '@quasibit/eleventy-plugin-sitemap';
import schema from '@quasibit/eleventy-plugin-schema';

/**
 * Return the plugin configuration list for Eleventy.
 * Each item is `[plugin, options]`.
 * @returns {Array<[Function, Object]>}
 */
export default function getPlugins() {
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
        ]),
        deadLinkReport: 'json'
      }
    ],
    [navigation],
    [syntaxHighlight, { preAttributes: { tabindex: 0 } }],
    [rss],
    // Tailwind compilation handled via PostCSS pipeline
    [sitemap, { sitemap: { hostname: 'https://effusionlabs.com' } }],
    [schema]
  ];
}
