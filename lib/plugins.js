// lib/eleventy/getPlugins.js

import interlinker from "@photogabble/eleventy-plugin-interlinker";
import navigation from "@11ty/eleventy-navigation";
import rss from "@11ty/eleventy-plugin-rss";
import sitemap from "@quasibit/eleventy-plugin-sitemap";
import schema from "@quasibit/eleventy-plugin-schema";

export default function getPlugins() {

  return [
    [
      interlinker,
      {
        defaultLayout: "layouts/embed.njk",
        resolvingFns: new Map([
          [
            "default",
            (link) => {
              const href = link.href || link.link || "#";
              const label = link.title || link.name || href;
              return `<a class="interlink" href="${href}">${label}</a>`;
            },
          ],
        ]),
        deadLinkReport: "json", // can be "console" or "none"
      },
    ],
    [navigation],
    [rss],
    [sitemap, { sitemap: { hostname: "https://effusionlabs.com" } }],
    [schema],
  ];
}
