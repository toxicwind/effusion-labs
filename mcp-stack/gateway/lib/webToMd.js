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

export default { htmlToMarkdown }
