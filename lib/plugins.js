import interlinkerPatched from "./interlinker-patch.mjs";
import navigation from "@11ty/eleventy-navigation";
import rss from "@11ty/eleventy-plugin-rss";
import sitemap from "@quasibit/eleventy-plugin-sitemap";
import schema from "@quasibit/eleventy-plugin-schema";

export default function getPlugins() {
  return [
    [
      interlinkerPatched,
      {
        defaultLayout: "layouts/embed.njk",
        resolvingFns: new Map([
          [
            "default",
            (link) => {
              const href = link.href || link.link;
              const label = link.title || link.name;
              return `<a class="interlink" href="${href}">${label}</a>`;
            },
          ],
        ]),
        deadLinkReport: "json",
      },
    ],
    [navigation],
    [rss],
    [sitemap, { sitemap: { hostname: "https://effusionlabs.com" } }],
    [schema],
  ];
}
