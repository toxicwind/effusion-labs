// Monolithic Eleventy config (ESM, Eleventy 3.x, Node 24+)
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import markdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'

import EleventyVitePlugin from '@11ty/eleventy-plugin-vite'

import EleventyPluginNavigation from '@11ty/eleventy-navigation'
import EleventyPluginRss from '@11ty/eleventy-plugin-rss'
import EleventyPluginSyntaxhighlight from '@11ty/eleventy-plugin-syntaxhighlight'
import interlinker from '@photogabble/eleventy-plugin-interlinker'
import sitemap from '@quasibit/eleventy-plugin-sitemap'
import schema from '@quasibit/eleventy-plugin-schema'
import { eleventyImageTransformPlugin } from '@11ty/eleventy-img'
import rollupPluginCritical from 'rollup-plugin-critical'
import tailwindcss from '@tailwindcss/vite'

import { dirs } from './src/lib/site.mjs'
import { applyMarkdownExtensions } from './src/lib/markdown/index.mjs'
import { registerFilters } from './src/lib/filters/index.mjs'
import { registerShortcodes } from './src/lib/shortcodes/index.mjs'
import { registerCollections } from './src/lib/collections/index.mjs'
import registerArchive from './src/lib/archives/index.mjs'
import { buildGlobals } from './src/lib/data/build.mjs'
import { getBuildInfo } from './src/lib/data/build-info.mjs'
import { buildNav } from './src/lib/data/nav.mjs'
import { buildArchiveNav } from './src/lib/archives/nav.mjs'
import htmlToMarkdownUnified from './src/lib/transforms/html-to-markdown.mjs'
import { createResolvers } from './src/lib/interlinkers/resolvers.mjs'
import { flushUnresolved } from './src/lib/interlinkers/unresolved-report.mjs'
import { eleventyComputed as computedGlobal } from './src/lib/data/computed.mjs'

export default function (eleventyConfig) {
  // --- Start: Event Handlers ---
  eleventyConfig.on('eleventy.before', async () => {
    // Clean Vite temp to avoid stale-dir issues
    const viteTemp = path.resolve(process.cwd(), '.11ty-vite')
    if (fs.existsSync(viteTemp)) {
      await fsp.rm(viteTemp, { recursive: true, force: true })
    }
  })

  // After build: write unresolved interlinker report (log-only)
  eleventyConfig.on('eleventy.after', () => {
    try {
      const payload = flushUnresolved()
      console.log(`Interlinker unresolved (logged only): ${payload.count}`)
    } catch (e) {
      console.error(String(e?.message || e))
    }
  })

  // --- End: Event Handlers ---
  eleventyConfig.setServerPassthroughCopyBehavior('copy')
  eleventyConfig.addPassthroughCopy('public')
  eleventyConfig.ignores.add('src/content/docs/**')
  const isTest = process.env.ELEVENTY_ENV === 'test'

  // Plugins
  eleventyConfig.addPlugin(EleventyPluginNavigation)
  eleventyConfig.addPlugin(EleventyPluginRss)
  eleventyConfig.addPlugin(EleventyPluginSyntaxhighlight)
  eleventyConfig.addPlugin(EleventyVitePlugin, {
    tempFolderName: '.11ty-vite', // Default name of the temp folder

    // Vite options (equal to vite.config.js inside project root)
    viteOptions: {
      publicDir: 'public',
      clearScreen: false,
      plugins: [tailwindcss()],
      server: {
        mode: 'development',
        middlewareMode: true,
      },
      appType: 'custom',
      assetsInclude: ['**/*.xml', '**/*.txt'],
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), 'src'),
          '/src': path.resolve(process.cwd(), 'src'),
        },
      },
      build: {
        mode: 'production',
        sourcemap: 'true',
        manifest: true,
        // This puts CSS and JS in subfolders – remove if you want all of it to be in /assets instead
        rollupOptions: {
          output: {
            assetFileNames: 'assets/[name].[hash][extname]',
            chunkFileNames: 'assets/[name].[hash].js',
            entryFileNames: 'assets/[name].[hash].js',
          },
          plugins: isTest
            ? []
            : [
                rollupPluginCritical({
                  criticalUrl: './_site/',
                  criticalBase: './_site/',
                  criticalPages: [{ uri: 'index.html' }, { uri: '404.html' }],
                  criticalConfig: {
                    inline: true,
                    dimensions: [
                      {
                        height: 900,
                        width: 375,
                      },
                      {
                        height: 720,
                        width: 1280,
                      },
                      {
                        height: 1080,
                        width: 1920,
                      },
                    ],
                  },
                }),
              ],
        },
      },
    },
  })

  eleventyConfig.addPlugin(interlinker, {
    defaultLayout: 'embed.njk',
    resolvingFns: createResolvers(),
    deadLinkReport: 'json',
  })

  eleventyConfig.addPlugin(sitemap, {
    sitemap: { hostname: 'https://effusionlabs.com' },
  })
  eleventyConfig.addPlugin(schema)

  if (!isTest) {
    eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
      urlPath: '/images/',
      outputDir: path.join(dirs.output, 'images/'),
      formats: ['avif', 'webp', 'auto'],
      widths: [320, 640, 960, 1200, 1800, 'auto'],
      filenameFormat: (id, src, width, format) => {
        const { name } = path.parse(src)
        const s = String(name || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
        return `${s}-${width}.${format}`
      },
    })
  }

  // --- End: Plugins ---
  eleventyConfig.addShortcode('year', () => `${new Date().getFullYear()}`)
  // --- Start: Libraries & Custom Functions ---
  // Customize Markdown library and settings:
  let markdownLibrary = markdownIt({
    html: true,
    breaks: true,
    linkify: true,
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({
      placement: 'after',
      class: 'direct-link',
      symbol: '#',
      level: [1, 2, 3, 4],
    }),
    slugify: eleventyConfig.getFilter('slug'),
  })
  eleventyConfig.setLibrary('md', markdownLibrary)

  // Nunjucks DX
  eleventyConfig.setNunjucksEnvironmentOptions({
    trimBlocks: false,
    lstripBlocks: false,
    noCache: true,
    throwOnUndefined: false,
  })
  eleventyConfig.addNunjucksFilter('ternary', (val, a, b) => (val ? a : b))

  // Markdown
  eleventyConfig.amendLibrary('md', md => {
    eleventyConfig.markdownLibrary = md
    return applyMarkdownExtensions(md)
  })

  // Filters, shortcodes, collections, archives from your /lib folder
  registerFilters(eleventyConfig)
  registerShortcodes(eleventyConfig)
  registerCollections(eleventyConfig)
  registerArchive(eleventyConfig)
  // Layouts
  eleventyConfig.addLayoutAlias('base', 'base.njk')
  // Programmatic Global Data
  eleventyConfig.addGlobalData('eleventyComputed', computedGlobal)
  eleventyConfig.addGlobalData('nav', buildNav())
  eleventyConfig.addGlobalData('archivesNav', buildArchiveNav())
  eleventyConfig.addGlobalData('build', async () => {
    const meta = getBuildInfo()
    const fx = await buildGlobals()
    return {
      ...fx,
      builtAtIso: meta.iso,
      env: meta.env,
      fullHash: meta.fullHash,
      branch: meta.branch,
    }
  })

  // HTML → Markdown importer for raw HTML inside content tree
  htmlToMarkdownUnified(eleventyConfig, {
    rootDir: 'src/content',
    dumpMarkdownTo: null,
    pageTitlePrefix: '',
    defaultLayout: 'converted-html.njk',
    frontMatterExtra: { convertedFromHtml: true },
  })

  // --- End: Libraries & Custom Functions ---
  // Copy/pass-through files
  eleventyConfig.addPassthroughCopy('src/assets/js')

  return {
    templateFormats: ['md', 'njk', 'html', 'liquid', '11ty.js'],
    htmlTemplateEngine: 'njk',
    passthroughFileCopy: true,
    dir: {
      input: 'src',
      // better not use "public" as the name of the output folder (see above...)
      output: process.env.ELEVENTY_TEST_OUTPUT || '_site',
      includes: '_includes',
      layouts: 'layouts',
      data: '_data',
    },
  }
}
