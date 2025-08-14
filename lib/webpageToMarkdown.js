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
  await configureProxyFromEnv(process.env, url);
  const { isCloudflareChallenge, realisticHeaders, persistedStatePath, shouldHeadful, markChallenge } = await import('../tools/shared/cf.mjs');
  let res = await fetch(url, { headers: realisticHeaders() });
  let html = await res.text();
  if(isCloudflareChallenge({ headers: Object.fromEntries(res.headers), body: html })){
    markChallenge();
    let retries = 0;
    while(retries < 3){
      const headful = shouldHeadful(retries);
      const jitter = retries === 2;
      const { BrowserEngine } = await import('../tools/shared/BrowserEngine.mjs');
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
        const markdown = htmlToMarkdown(html, url);
        await engine.close();
        return markdown;
      }catch(err){
        await engine.close();
        retries++;
        if(retries>=3) throw err;
      }
    }
    throw new Error('cloudflare_challenge');
  }
  return htmlToMarkdown(html, url);
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
