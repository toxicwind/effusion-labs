const fs = require('fs/promises');
const { BrowserEngine } = require('../shared/BrowserEngine.mjs');
const { buildGoogleUrl } = require('./url.js');
const { parseSerp } = require('./parser.js');
const { acceptConsent } = require('./consent.js');
const { isCloudflareChallenge, persistedStatePath, shouldHeadful, markChallenge } = require('../shared/cf.mjs');

async function search(q, opts={}){
  const htmlPath = opts.htmlPath || process.env.SEARCH2SERP_HTML_PATH;
  if(htmlPath){
    const html = await fs.readFile(htmlPath, 'utf8');
    const results = parseSerp(html);
    return { query:q, results, proxy:{ enabled:false }, traceFile:null };
  }
  let retries = 0;
  const url = buildGoogleUrl({ q, hl:opts.hl, gl:opts.gl, num:opts.num, start:opts.start });
  while(retries < 3){
    const headful = shouldHeadful(retries);
    const jitter = retries === 2;
    const engine = await BrowserEngine.create({ statePath: persistedStatePath, headless: !headful, jitter });
    try {
      const page = await engine.newPage();
      await page.goto(url, { waitUntil:'domcontentloaded' });
      await acceptConsent(page);
      const html = await page.content();
      if(isCloudflareChallenge(html)){
        markChallenge();
        await engine.close();
        retries++; 
        continue;
      }
      const results = parseSerp(html);
      const out = { query:q, url, results, proxy:engine.proxy, traceFile:engine.traceFile };
      await engine.close();
      return out;
    } catch(err){
      await engine.close();
      retries++;
      if(retries>=3) throw err;
    }
  }
  throw new Error('cloudflare_challenge');
}

module.exports = { search, buildGoogleUrl, parseSerp, acceptConsent };
