// Monolithic Eleventy config (ESM, Eleventy 3.x, Node 24+)
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import EleventyVitePlugin from '@11ty/eleventy-plugin-vite'
import interlinker from '@photogabble/eleventy-plugin-interlinker'
import navigation from '@11ty/eleventy-navigation'
import rss from '@11ty/eleventy-plugin-rss'
import sitemap from '@quasibit/eleventy-plugin-sitemap'
import schema from '@quasibit/eleventy-plugin-schema'
import { eleventyImageTransformPlugin } from '@11ty/eleventy-img'

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
  // Nunjucks DX
  eleventyConfig.setNunjucksEnvironmentOptions({
    trimBlocks: false,
    lstripBlocks: false,
    noCache: true,
    throwOnUndefined: false,
  })
  eleventyConfig.addNunjucksFilter('ternary', (val, a, b) => (val ? a : b))

  // Clean Vite temp to avoid stale-dir issues
  eleventyConfig.on('eleventy.before', async () => {
    const viteTemp = path.resolve(process.cwd(), '.11ty-vite')
    try {
      if (fs.existsSync(viteTemp))
        await fsp.rm(viteTemp, { recursive: true, force: true })
    } catch {}
  })
  // Optional: auto-rewrite basic ternaries in Nunjucks
  eleventyConfig.on('eleventy.before', async () => {
    try {
      const { fixRepoTernaries } = await import('./tools/fix-njk-ternaries.mjs')
      await fixRepoTernaries({
        roots: ['src'],
        exts: ['.njk', '.md', '.html'],
        dryRun: false,
        logFile: '.njk-fix-report.json',
        quiet: true,
      })
    } catch {}
  })

  // Honor repo ignores (keep dev ergonomics)
  eleventyConfig.ignores.add('src/content/docs/vendor/**')
  eleventyConfig.ignores.add('src/content/docs/vendors/**')

  // Markdown
  eleventyConfig.amendLibrary('md', md => {
    eleventyConfig.markdownLibrary = md
    return applyMarkdownExtensions(md)
  })

  // Filters, shortcodes, collections, archives
  registerFilters(eleventyConfig)
  registerShortcodes(eleventyConfig)
  registerCollections(eleventyConfig)
  registerArchive(eleventyConfig)

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
    defaultLayout: 'layouts/converted-html.njk',
    frontMatterExtra: { convertedFromHtml: true },
  })

  // Non-Vite plugins
  eleventyConfig.addPlugin(interlinker, {
    defaultLayout: 'layouts/base.njk',
    resolvingFns: createResolvers(),
    deadLinkReport: 'json',
  })
  eleventyConfig.addPlugin(navigation)
  eleventyConfig.addPlugin(rss)
  eleventyConfig.addPlugin(sitemap, {
    sitemap: { hostname: 'https://effusionlabs.com' },
  })
  eleventyConfig.addPlugin(schema)
  const isTest = process.env.ELEVENTY_ENV === 'test'
  if (!isTest)
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

  // After build: write unresolved interlinker report (log-only)
  eleventyConfig.on('eleventy.after', () => {
    try {
      const payload = flushUnresolved()
      console.log(`Interlinker unresolved (logged only): ${payload.count}`)
    } catch (e) {
      console.error(String(e?.message || e))
    }
  })

  // Vite — register last; no duplicated responsibilities
  eleventyConfig.addPlugin(EleventyVitePlugin, { tempFolderName: '.11ty-vite' })

  return {
    dir: dirs,
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: false,
    templateFormats: ['md', 'njk', 'html', '11ty.js'],
    pathPrefix: '/',
  }
}
