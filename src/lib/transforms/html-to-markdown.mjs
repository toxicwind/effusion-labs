import path from 'node:path'
import fs from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkStringify from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import remarkSmartypants from 'remark-smartypants'
import remarkMath from 'remark-math'

// Simple pre-clean: drop noisy tags before HTML→Markdown
function rehypeStripTags(tags = ['script', 'style', 'noscript']) {
  return function stripTags() {
    return tree => {
      if (!tree || !tree.children) return
      tree.children = tree.children.filter(node => {
        if (node.type === 'element' && tags.includes(node.tagName)) return false
        return true
      })
    }
  }
}

function inScope(inputPath, root) {
  const p = path.normalize(inputPath)
  const r = path.normalize(root) + path.sep
  return p.includes(r)
}

async function htmlFragmentToMarkdown(html) {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeStripTags(['script', 'style', 'noscript']))
    .use(rehypeRemark) // HAST → MDAST
    .use(remarkGfm) // tables, task lists, strikethrough, autolinks
    .use(remarkMath)
    .use(remarkSmartypants)
    .use(remarkStringify, {
      bullet: '-',
      rule: '-',
      fences: true,
      fence: '`',
      listItemIndent: 'one',
      emphasis: '_',
      strong: '*',
      quote: '"',
    })
    .process(html)

  return String(file)
}

export default function htmlToMarkdownUnified(
  eleventyConfig,
  {
    rootDir = 'src/content',
    dumpMarkdownTo = null,
    defaultLayout = null,
    pageTitlePrefix = '',
    frontMatterExtra = {},
  } = {}
) {
  // IMPORTANT: do not set `key` when overriding a built-in language like "html"
  eleventyConfig.addExtension('html', {
    outputFileExtension: 'md', // emit Markdown so your normal MD pipeline/layouts apply

    compile: function (inputContent, inputPath) {
      if (!inScope(inputPath, rootDir)) return undefined

      return async () => {
        // 1) Readability extraction
        const dom = new JSDOM(inputContent, { url: 'https://local.source/' })
        const reader = new Readability(dom.window.document)
        const article = reader.parse()

        const title =
          article?.title || path.basename(inputPath).replace(/\.html$/i, '')
        const byline = article?.byline || ''
        const excerpt = article?.excerpt || ''
        const length = article?.length || 0

        const extractedHtml = article?.content || inputContent

        // 2) HTML → Markdown (unified pipeline)
        const markdownBody = await htmlFragmentToMarkdown(extractedHtml)

        // 3) Minimal front matter—do not set tags/layout unless explicitly requested
        const fm = {
          ...(defaultLayout ? { layout: defaultLayout } : {}),
          title: `${pageTitlePrefix}${title}`,
          byline,
          excerpt,
          sourcePath: inputPath,
          readabilityLength: length,
          ...frontMatterExtra,
        }

        const fmLines = [
          '---',
          ...Object.entries(fm)
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => {
              if (typeof v === 'string') {
                const safe = v.replace(/"/g, '\\"')
                return `${k}: "${safe}"`
              }
              return `${k}: ${JSON.stringify(v)}`
            }),
          '---',
          '',
        ]

        const mdFull = fmLines.join('\n') + markdownBody.trim() + '\n'

        // Optional debug dump of the generated .md
        if (dumpMarkdownTo) {
          const relOut = inputPath.replace(
            path.normalize(rootDir) + path.sep,
            ''
          )
          const mdOutPath = path.join(
            dumpMarkdownTo,
            relOut.replace(/\.html$/i, '.md')
          )
          await fs.mkdir(path.dirname(mdOutPath), { recursive: true })
          await fs.writeFile(mdOutPath, mdFull, 'utf8')
        }

        return mdFull
      }
    },
  })
}
