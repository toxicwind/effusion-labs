// eleventy.config.mjs
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import register from './config/register.mjs';
import registerArchive from './config/archives.mjs';
import { getBuildInfo } from './config/build-info.js';
import { dirs } from './config/site.js';
import htmlToMarkdownUnified from './config/html-to-markdown-unified.mjs';

// (optional) Vite integration here too, safe to no-op if you already add it elsewhere
import EleventyVitePlugin from '@11ty/eleventy-plugin-vite';
import tailwind from '@tailwindcss/vite';

export default function (eleventyConfig) {
  const fromRoot = (...p) => path.resolve(process.cwd(), ...p);
  // saner nunjucks errors while debugging
  eleventyConfig.setNunjucksEnvironmentOptions({
    trimBlocks: false,
    lstripBlocks: false,
    noCache: true,
    throwOnUndefined: false,
  });

  // ternary filter (pairs with the rewrite step below)
  eleventyConfig.addNunjucksFilter('ternary', (val, a, b) => (val ? a : b));

  // pre-clean vite temp dir to prevent EISDIR on stale folders
  eleventyConfig.on('eleventy.before', async () => {
    const viteTemp = path.join(process.cwd(), '.11ty-vite');
    try {
      if (fs.existsSync(viteTemp)) {
        await fsp.rm(viteTemp, { recursive: true, force: true });
      }
    } catch {}
  });

  // auto-fix simple nunjucks ternaries `? :` → `| ternary(a,b)`
  eleventyConfig.on('eleventy.before', async () => {
    try {
      const { fixRepoTernaries } = await import(
        './utils/scripts/fix-njk-ternaries.mjs'
      );
      await fixRepoTernaries({
        roots: ['src'],
        exts: ['.njk', '.md', '.html'],
        dryRun: false,
        logFile: '.njk-fix-report.json',
        quiet: true,
      });
    } catch (err) {
      console.error('[njk-fix] failed:', err?.message || err);
    }
  });

  // ⬇️ CRITICAL: copy all assets (css, js, images) so Vite can import "../css/app.css" from the built JS
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });
  eleventyConfig.addWatchTarget('src/assets');

  // your existing setup (this also installs plugins via config/plugins.js)
  register(eleventyConfig);
  registerArchive(eleventyConfig);

  eleventyConfig.addGlobalData('build', getBuildInfo());
  eleventyConfig.addGlobalData('buildTime', new Date().toISOString());

  // HTML → Markdown pipeline
  htmlToMarkdownUnified(eleventyConfig, {
    rootDir: 'src/content',
    dumpMarkdownTo: '_cache/md-dumps',
    pageTitlePrefix: '',
    defaultLayout: 'layouts/converted-html.njk',
    frontMatterExtra: { convertedFromHtml: true },
  });

  // Optional: if your dev runner doesn’t already add the Vite plugin, this will.
  try {
    eleventyConfig.addPlugin(EleventyVitePlugin, {
      tempFolderName: '.11ty-vite',
      viteOptions: {
        clearScreen: false,
        appType: 'mpa',
        plugins: [tailwind()],
        resolve: {
          alias: {
            '@': fromRoot('src'),
            '/node_modules': fromRoot('node_modules'),
          },
        },
        server: {
          fs: {
            strict: true,
            allow: [fromRoot(), fromRoot('src')],
          },
        },
        css: { devSourcemap: true },
      },
    });
  } catch {
    // ignore if already added elsewhere
  }

  return {
    dir: dirs,
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: false, // don’t parse raw .html through Liquid
    templateFormats: ['md', 'njk', 'html', '11ty.js'],
    pathPrefix: '/',
  };
}
