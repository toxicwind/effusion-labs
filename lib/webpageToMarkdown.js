const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
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

function htmlToMarkdown(html, url='about:blank'){
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const turndownService = new TurndownService();
  const source = article && article.content ? article.content : dom.serialize();
  return turndownService.turndown(source);
}

module.exports = { webpageToMarkdown, htmlToMarkdown };
