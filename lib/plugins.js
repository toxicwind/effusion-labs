// lib/eleventy/getPlugins.js

import interlinker from "@photogabble/eleventy-plugin-interlinker";
import navigation from "@11ty/eleventy-navigation";
import rss from "@11ty/eleventy-plugin-rss";
import sitemap from "@quasibit/eleventy-plugin-sitemap";
import schema from "@quasibit/eleventy-plugin-schema";
import { createResolvers } from "./interlinkers/resolvers.mjs";
import { summarizeAndGate } from "./interlinkers/unresolved-report.mjs";

export default function getPlugins() {

  return [
    [
      interlinker,
      {
        defaultLayout: "layouts/embed.njk",
        resolvingFns: createResolvers(),
        deadLinkReport: "json", // can be "console" or "none"
      },
    ],
    [navigation],
    [rss],
    [sitemap, { sitemap: { hostname: "https://effusionlabs.com" } }],
    [schema],
  ];
}
