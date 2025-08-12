const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { configureProxyFromEnv } = require('../../lib/proxyAgent');

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
  await configureProxyFromEnv();
  const { isCloudflareChallenge, realisticHeaders, persistedStatePath, shouldHeadful, markChallenge } = await import('../shared/cf.mjs');
  let res = await fetch(url, { headers: realisticHeaders() });
  let html = await res.text();
  if(isCloudflareChallenge({ headers: Object.fromEntries(res.headers), body: html })){
    markChallenge();
    let retries = 0;
    while(retries < 3){
      const headful = shouldHeadful(retries);
      const jitter = retries === 2;
      const { BrowserEngine } = await import('../shared/BrowserEngine.mjs');
      const engine = await BrowserEngine.create({ statePath: persistedStatePath, headless: !headful, jitter });
      try{
        const page = await engine.newPage();
        await page.goto(url, { waitUntil:'networkidle' });
        html = await page.content();
        if(isCloudflareChallenge(html)){
          markChallenge();
          await engine.close();
          retries++;
          continue;
        }
        const markdown = normalizeHTML(html, url);
        const result = { html, markdown, proxy: engine.proxy, traceFile: engine.traceFile };
        await engine.close();
        return result;
      }catch(err){
        await engine.close();
        retries++;
        if(retries >= 3) throw err;
      }
    }
    throw new Error('cloudflare_challenge');
  }
  const markdown = normalizeHTML(html, url);
  return { html, markdown, proxy:{ enabled:!!process.env.CHAIN_PROXY_URL, server: process.env.CHAIN_PROXY_URL || null }, traceFile:null };
}

module.exports = { fetchWithFallback, fetchWithBrowser: fetchWithFallback, normalizeHTML };

