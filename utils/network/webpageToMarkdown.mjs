import { JSDOM } from 'jsdom'
let Readability
try {
  ;({ Readability } = await import('@mozilla/readability'))
} catch {
  Readability = null
}
let TurndownService
try {
  ;({ default: TurndownService } = await import('turndown'))
} catch {
  TurndownService = class {
    turndown(html) {
      return html
    }
  }
}
import { request } from './flareClient.js'

/**
 * Fetch a webpage and convert its main content to Markdown.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function webpageToMarkdown(url) {
  if (!url) throw new Error('URL is required')
  const { realisticHeaders } = await import('../utils/build/cf.mjs')
  const res = await request.get(url, { headers: realisticHeaders() })
  return htmlToMarkdown(res.body, res.url)
}

export function htmlToMarkdown(html, url = 'about:blank') {
  const dom = new JSDOM(html, { url })
  let source = dom.serialize()
  if (Readability) {
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    if (article && article.content) source = article.content
  }
  const turndownService = new TurndownService()
  return turndownService.turndown(source)
}

export default { webpageToMarkdown, htmlToMarkdown }
