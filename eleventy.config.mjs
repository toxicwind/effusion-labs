// eleventy.config.mjs
// Node 24+ ESM • Eleventy 3.x • @11ty/eleventy-plugin-vite v7
// Assets are now served by Vite from /public (no Eleventy passthrough).

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import register from './config/register.mjs'
import registerArchive from './config/archives.mjs'
import { getBuildInfo } from './config/build-info.js'
import { dirs } from './config/site.js'
import htmlToMarkdownUnified from './config/html-to-markdown-unified.mjs'

import EleventyVitePlugin from '@11ty/eleventy-plugin-vite'

export default function (eleventyConfig) {
  // Nunjucks DX
  eleventyConfig.setNunjucksEnvironmentOptions({
    trimBlocks: false,
    lstripBlocks: false,
    noCache: true,
    throwOnUndefined: false,
  })

  // Tiny ternary helper: {{ cond | ternary('a','b') }}
  eleventyConfig.addNunjucksFilter('ternary', (val, a, b) => (val ? a : b))

  // Pre-clean Vite’s temp folder to avoid stale-dir issues
  eleventyConfig.on('eleventy.before', async () => {
    const viteTemp = path.resolve(process.cwd(), '.11ty-vite')
    try {
      if (fs.existsSync(viteTemp)) {
        await fsp.rm(viteTemp, { recursive: true, force: true })
      }
    } catch { }
  })

  // Auto-rewrite simple njk ternaries (`? :` → `| ternary(a,b)`)
  eleventyConfig.on('eleventy.before', async () => {
    try {
      const { fixRepoTernaries } = await import('./utils/scripts/fix-njk-ternaries.mjs')
      await fixRepoTernaries({
        roots: ['src'],
        exts: ['.njk', '.md', '.html'],
        dryRun: false,
        logFile: '.njk-fix-report.json',
        quiet: true,
      })
    } catch (err) {
      console.error('[njk-fix] failed:', err?.message || err)
    }
  })

  // IMPORTANT: No passthroughs for src/assets — Vite owns static via /public
  // (Removed:)

  // Your existing setup
  register(eleventyConfig)
  registerArchive(eleventyConfig)

  eleventyConfig.addGlobalData('build', getBuildInfo())
  eleventyConfig.addGlobalData('buildTime', new Date().toISOString())

  // HTML → Markdown pipeline
  htmlToMarkdownUnified(eleventyConfig, {
    rootDir: 'src/content',
    dumpMarkdownTo: '_cache/md-dumps',
    pageTitlePrefix: '',
    defaultLayout: 'layouts/converted-html.njk',
    frontMatterExtra: { convertedFromHtml: true },
  })

  // Vite integration (minimal): let vite.config.mjs dictate plugins/options.
  // The Eleventy plugin will run Vite in middleware mode and handle rewrites.
  eleventyConfig.addPlugin(EleventyVitePlugin, {
    tempFolderName: '.11ty-vite',
    // No viteOptions here — keep all Vite/Tailwind/daisyUI config in vite.config.mjs
  })

  return {
    dir: dirs, // expect { input: 'src', output: '_site', includes: '_includes', data: '_data', … }
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: false, // don’t parse raw .html through Liquid
    templateFormats: ['md', 'njk', 'html', '11ty.js'],
    pathPrefix: '/', // if deploying under a subpath, update this AND Vite's `base`
  }
}
