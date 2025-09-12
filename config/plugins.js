// config/plugins.js
import interlinker from "@photogabble/eleventy-plugin-interlinker";
import navigation from "@11ty/eleventy-navigation";
import rss from "@11ty/eleventy-plugin-rss";
import sitemap from "@quasibit/eleventy-plugin-sitemap";
import schema from "@quasibit/eleventy-plugin-schema";
import vitePlugin from "@11ty/eleventy-plugin-vite";
import { createResolvers } from "./interlinkers/resolvers.mjs";

export default function getPlugins() {
  const plugins = [
    [
      interlinker,
      {
        // Use your normal site shell
        defaultLayout: "layouts/base.njk",
        resolvingFns: createResolvers(),
        deadLinkReport: "json", // artifact only (no CI gating)
      },
    ],
    [navigation],
    [rss],
    [sitemap, { sitemap: { hostname: "https://effusionlabs.com" } }],
    [schema],
    // Vite on by default – stable minimal config for Eleventy integration
    [
      vitePlugin,
      {
        tempFolderName: ".11ty-vite",
        viteOptions: {
          clearScreen: false,
          appType: "custom",
          server: { middlewareMode: true },
          build: {
            emptyOutDir: true, // wipe .11ty-vite on build (we also clean in eleventy.before)
          },
          // Allow Vite to also look for assets in /_site during dev transforms
          publicDir: false,
        },
      },
    ],
  ];

  return plugins;
}
