// Monolithic Eleventy config (ESM, Eleventy 3.x, Node 24+)
import markdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import EleventyVitePlugin from '@11ty/eleventy-plugin-vite'

import EleventyPluginNavigation from '@11ty/eleventy-navigation'
import EleventyPluginRss from '@11ty/eleventy-plugin-rss'
import EleventyPluginSyntaxhighlight from '@11ty/eleventy-plugin-syntaxhighlight'
import interlinker from '@photogabble/eleventy-plugin-interlinker'
import schema from '@quasibit/eleventy-plugin-schema'
import sitemap from '@quasibit/eleventy-plugin-sitemap'
import tailwindcss from '@tailwindcss/vite'
import Beasties from 'beasties'
import localImageTransformPlugin from './src/lib/plugins/local-image-transform.mjs'

import registerArchive from './src/lib/archives/index.mjs'
import { buildArchiveNav } from './src/lib/archives/nav.mjs'
import { registerCollections } from './src/lib/collections/index.mjs'
import { getBuildInfo } from './src/lib/data/build-info.mjs'
import { buildGlobals } from './src/lib/data/build.mjs'
import { eleventyComputed as computedGlobal } from './src/lib/data/computed.mjs'
import { buildNav } from './src/lib/data/nav.mjs'
import { registerFilters } from './src/lib/filters/index.mjs'
import { createResolvers } from './src/lib/interlinkers/resolvers.mjs'
import { flushUnresolved } from './src/lib/interlinkers/unresolved-report.mjs'
import { applyMarkdownExtensions } from './src/lib/markdown/index.mjs'
import { registerShortcodes } from './src/lib/shortcodes/index.mjs'
import { dirs } from './src/lib/site.mjs'
import htmlToMarkdownUnified from './src/lib/transforms/html-to-markdown.mjs'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(projectRoot, 'src')
const criticalPages = ['index.html', '404.html']
const outputDir = path.join(projectRoot, dirs.output)

export default function(eleventyConfig) {
  // --- Start: Event Handlers ---
  eleventyConfig.on('eleventy.before', async () => {
    // Clean Vite temp to avoid stale-dir issues
    const viteTemp = path.join(projectRoot, '.11ty-vite')
    if (fs.existsSync(viteTemp)) {
      await fsp.rm(viteTemp, { recursive: true, force: true })
    }
  })

  // After build: write unresolved interlinker report (log-only) and inline critical CSS
  eleventyConfig.on('eleventy.after', async () => {
    try {
      const payload = flushUnresolved()
      console.log(`Interlinker unresolved (logged only): ${payload.count}`)
    } catch (e) {
      console.error(String(e?.message || e))
    }

    if (process.env.ELEVENTY_ENV === 'test') {
      return
    }

    const beasties = new Beasties({
      path: outputDir,
      publicPath: '/',
      preload: 'swap',
      inlineFonts: true,
      compress: true,
      pruneSource: false,
      logLevel: 'warn',
    })

    const wait = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      })

    const ensurePageOutput = async (targetPath, { attempts = 10, backoff = 100 } = {}) => {
      for (let index = 0; index < attempts; index++) {
        try {
          await fsp.access(targetPath, fs.constants.F_OK)
          return true
        } catch {
          await wait(backoff * (index + 1))
        }
      }

      return false
    }

    await Promise.all(
      criticalPages.map(async (page) => {
        const targetPath = path.join(outputDir, page)

        const hasInitialOutput = await ensurePageOutput(targetPath)

        if (!hasInitialOutput) {
          console.warn(
            `Beasties inline skipped for ${page}: missing file at ${targetPath}`,
          )
          return
        }

        const maxAttempts = 5

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const html = await fsp.readFile(targetPath, 'utf8')
            const inlined = await beasties.process(html)
            await fsp.writeFile(targetPath, inlined)
            return
          } catch (error) {
            if (error?.code === 'ENOENT' && error?.path === targetPath) {
              await wait(200 * (attempt + 1))
              await ensurePageOutput(targetPath, { attempts: 1 })
              continue
            }

            console.error(`Beasties inline failed for ${page}:`, String(error?.message || error))
            return
          }
        }

        console.warn(
          `Beasties inline skipped for ${page}: ${targetPath} unavailable after retries`,
        )
      }),
    )
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
        fs: {
          allow: [projectRoot, srcDir],
        },
      },
      appType: 'custom',
      assetsInclude: ['**/*.xml', '**/*.txt'],
      resolve: {
        alias: {
          '@': srcDir,
          '/src': srcDir,
          '/assets': path.join(srcDir, 'assets'),
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

  eleventyConfig.addTransform('normalize-remote-urls', (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith('.html')) return content
    return content
      .replace(/(src|href)=["']{2}(https?:\/\/)/g, '$1="$2')
      .replace(/(src|href)=["']{2}(\/\/)/g, '$1="$2')
      .replace(/(src|href)=["']{2}(data:)/g, '$1="$2')
  })

  if (eleventyConfig.htmlTransformer?.addPosthtmlPlugin) {
    // Ensure remote image URLs are passed through untouched — the Eleventy image
    // transform plugin eagerly attempts to download external assets otherwise.
    eleventyConfig.htmlTransformer.addPosthtmlPlugin(
      'html',
      function remoteImagePassthrough() {
        return (tree) => {
          const sanitize = (value) => {
            if (typeof value !== 'string') return ''
            return value.trim().replace(/^['"]+/, '').replace(/['"]+$/, '')
          }

          const markRemote = (node, attr) => {
            const raw = node?.attrs?.[attr]
            if (typeof raw !== 'string') return node
            const normalized = sanitize(raw)
            if (/^https?:\/\//i.test(normalized) || /^\/\//.test(normalized) || normalized.startsWith('data:')) {
              node.attrs ||= {}
              node.attrs[attr] = normalized
              if (!('eleventy:ignore' in node.attrs)) {
                node.attrs['eleventy:ignore'] = ''
              }
            }
            return node
          }

          tree.match({ tag: 'img' }, (node) => markRemote(node, 'src'))
          tree.match({ tag: 'link' }, (node) => markRemote(node, 'href'))

          return tree
        }
      },
      { priority: 1 },
    )
  }

  const enableImagePlugin = (
    !isTest || process.env.ELEVENTY_TEST_ENABLE_IMAGES === '1'
  ) && process.env.BUILD_OFFLINE !== '1'

  if (enableImagePlugin) {
    eleventyConfig.addPlugin(localImageTransformPlugin, {
      urlPath: '/images/',
      outputDir: path.join(dirs.output, 'images/'),
      formats: ['avif', 'webp', 'auto'],
      widths: [320, 640, 960, 1200, 1800, 'auto'],
      filenameFormat: (id, src, width, format) => {
        const { name } = path.parse(src)
        const s = String(name || '')
          .toLowerCase()
          .replace(/[^\da-z]+/g, '-')
        return `${s}-${width}.${format}`
      },
      cacheOptions: {
        directory: path.join(projectRoot, '.cache', 'eleventy-img'),
        removeUrlQueryParams: false,
        duration: '6w',
      },
    })
  }

  if (!enableImagePlugin) {
    eleventyConfig.addPassthroughCopy({ 'src/images': 'images' })
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
    frontMatterExtra: { source: 'html-import' },
    smartTypography: false, // keep MD diffs clean; flip to true if you want curly quotes baked in
  })

  // --- End: Libraries & Custom Functions ---
  // Copy/pass-through files
  eleventyConfig.addPassthroughCopy('src/assets/js')
  eleventyConfig.addPassthroughCopy({
    'src/content/projects/lv-images/generated': 'content/projects/lv-images/generated',
  })

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
