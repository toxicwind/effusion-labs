const fs = require('fs/promises');
const { BrowserEngine } = require('../shared/BrowserEngine.mjs');
const { buildGoogleUrl } = require('./url.js');
const { parseSerp } = require('./parser.js');
const { acceptConsent } = require('./consent.js');
const { isCloudflareChallenge, markChallenge } = require('../shared/cf.mjs');

async function search(q, opts={}, attempt=0){
  const htmlPath = opts.htmlPath || process.env.SEARCH2SERP_HTML_PATH;
  if(htmlPath){
    const html = await fs.readFile(htmlPath, 'utf8');
    const results = parseSerp(html);
    return { query:q, results, proxy:{ enabled:false }, traceFile:null };
  }
  const engine = await BrowserEngine.create({ retry:attempt });
  const page = await engine.newPage();
  const url = buildGoogleUrl({ q, hl:opts.hl, gl:opts.gl, num:opts.num, start:opts.start });
  await page.goto(url, { waitUntil:'domcontentloaded' });
  await acceptConsent(page);
  await page.waitForSelector('#search');
  const html = await page.content();
  if(isCloudflareChallenge(html)){
    console.log(`search2serp: Cloudflare challenge detected (attempt ${attempt})`);
    markChallenge();
    await engine.close();
    if(attempt < 2) return await search(q, opts, attempt+1);
  }
  const results = parseSerp(html);
  const out = { query:q, url, results, proxy:engine.proxy, traceFile:engine.traceFile };
  await engine.close();
  return out;
}

module.exports = { search, buildGoogleUrl, parseSerp, acceptConsent };
