// config/plugins.js
import { fileURLToPath, URL } from 'node:url';
import interlinker from '@photogabble/eleventy-plugin-interlinker';
import navigation from '@11ty/eleventy-navigation';
import rss from '@11ty/eleventy-plugin-rss';
import sitemap from '@quasibit/eleventy-plugin-sitemap';
import schema from '@quasibit/eleventy-plugin-schema';
import vitePlugin from '@11ty/eleventy-plugin-vite';
import { createResolvers } from '../config/interlinkers/resolvers.mjs';

export default function getPlugins() {
  const plugins = [
    [
      interlinker,
      {
        // Use your normal site shell
        defaultLayout: 'layouts/base.njk',
        resolvingFns: createResolvers(),
        deadLinkReport: 'json', // write unresolved report artifact only (no gating)
      },
    ],
    [navigation],
    [rss],
    [sitemap, { sitemap: { hostname: 'https://effusionlabs.com' } }],
    [schema],
  ];

  // Vite: always on (you said you want it extensively)
  plugins.push([
    vitePlugin,
    {
      // keep the temp dir stable
      tempFolderName: '.11ty-vite',
      viteOptions: {
        clearScreen: false,
        appType: 'custom',
        resolve: {
          alias: {
            '@': fileURLToPath(new URL('../src', import.meta.url)),
          },
        },
        server: { middlewareMode: true },
        css: { devSourcemap: true },
        build: {
          manifest: true,
          rollupOptions: {
            // Ensure our JS entry (which imports CSS) is known to Vite
            input: ['/assets/js/app.js'],
          },
        },
      },
    },
  ]);

  return plugins;
}
