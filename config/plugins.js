import interlinker from "@photogabble/eleventy-plugin-interlinker";
import navigation from "@11ty/eleventy-navigation";
import rss from "@11ty/eleventy-plugin-rss";
import sitemap from "@quasibit/eleventy-plugin-sitemap";
import schema from "@quasibit/eleventy-plugin-schema";
import vitePlugin from "@11ty/eleventy-plugin-vite";
import { createResolvers } from "./interlinkers/resolvers.mjs";

// Minimal Vite options that play nice with Eleventy’s _site output
const viteOpts = {
  appType: "mpa",
  server: { middlewareMode: true },
  build: { outDir: "_site", emptyOutDir: false },
  publicDir: "src/assets", // static passthrough
};

export default function getPlugins() {
  return [
    [
      interlinker,
      {
        defaultLayout: "layouts/embed.njk",
        resolvingFns: createResolvers(),
        deadLinkReport: "json",
      },
    ],
    [navigation],
    [rss],
    [sitemap, { sitemap: { hostname: "https://effusionlabs.com" } }],
    [schema],
    [vitePlugin, viteOpts], // ← added
  ];
}
