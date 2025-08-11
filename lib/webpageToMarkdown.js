const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { configureProxyFromEnv } = require('./proxyAgent');

/**
 * Fetch a webpage and convert its main content to Markdown.
 * Falls back to full document when Readability cannot parse.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function webpageToMarkdown(url) {
  if (!url) throw new Error('URL is required');
  await configureProxyFromEnv();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const turndownService = new TurndownService();
  const source = article && article.content ? article.content : dom.serialize();
  return turndownService.turndown(source);
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
