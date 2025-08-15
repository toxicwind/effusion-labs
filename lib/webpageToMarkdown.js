const { JSDOM } = require('jsdom');
let Readability;
try {
  ({ Readability } = require('@mozilla/readability'));
} catch {
  Readability = null;
}
let TurndownService;
try {
  TurndownService = require('turndown');
} catch {
  TurndownService = class {
    turndown(html) {
      return html;
    }
  };
}
const { request } = require('./flareClient');

/**
 * Fetch a webpage and convert its main content to Markdown.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function webpageToMarkdown(url) {
  if (!url) throw new Error('URL is required');
  const { realisticHeaders } = await import('../tools/shared/cf.mjs');
  const res = await request.get(url, { headers: realisticHeaders() });
  return htmlToMarkdown(res.body, res.url);
}

function htmlToMarkdown(html, url = 'about:blank') {
  const dom = new JSDOM(html, { url });
  let source = dom.serialize();
  if (Readability) {
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article && article.content) source = article.content;
  }
  const turndownService = new TurndownService();
  return turndownService.turndown(source);
}

module.exports = { webpageToMarkdown, htmlToMarkdown };
