import { JSDOM } from 'jsdom'
import { request } from './flareClient.mjs'

function realisticHeaders() {
  return {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
  }
}

export async function webpageToMarkdown(url) {
  if (!url) throw new Error('URL is required')
  const res = await request.get(url, { headers: realisticHeaders() })
  return htmlToMarkdown(res.body, res.url)
}

export async function htmlToMarkdown(html, url = 'about:blank') {
  const dom = new JSDOM(html, { url })
  let source = dom.serialize()
  let Readability = null
  let TurndownService = null
  try {
    ;({ Readability } = await import('@mozilla/readability'))
  } catch {}
  try {
    ;({ default: TurndownService } = await import('turndown'))
  } catch {}
  if (Readability) {
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    if (article && article.content) source = article.content
  }
  const td = TurndownService ? new TurndownService() : { turndown: s => s }
  return td.turndown(source)
}

export default { webpageToMarkdown, htmlToMarkdown }
