const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { request } = require('../../lib/flareClient');

function stripTracking(u){
  const url = new URL(u);
  for(const k of [...url.searchParams.keys()]){
    if(/^utm_/.test(k) || k==='fbclid') url.searchParams.delete(k);
  }
  return url.toString();
}

function normalizeHTML(html, url){
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const links = doc.querySelectorAll('a[href]');
  links.forEach(a=>{ try{ a.href = stripTracking(a.href); }catch{} });
  const reader = new Readability(doc);
  const article = reader.parse();
  const turndown = new TurndownService({ headingStyle: 'atx' });
  const source = article && article.content ? article.content : doc.body.innerHTML;
  const md = turndown.turndown(source).replace(/\s+/g,' ').trim();
  return md;
}

async function fetchWithFallback(url){
  const { realisticHeaders } = await import('../shared/cf.mjs');
  const res = await request.get(url, { headers: realisticHeaders() });
  const markdown = normalizeHTML(res.body, url);
  return { html: res.body, markdown, proxy:{ enabled:true }, traceFile:null };
}

module.exports = { fetchWithFallback, fetchWithBrowser: fetchWithFallback, normalizeHTML };
