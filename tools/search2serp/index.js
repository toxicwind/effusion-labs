const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { BrowserEngine } = require('../shared/BrowserEngine.mjs');
const { buildGoogleUrl } = require('./url.js');
const { parseSerp } = require('./parser.js');
const { acceptConsent } = require('./consent.js');

async function search(q, opts={}){
  const htmlPath = opts.htmlPath || process.env.SEARCH2SERP_HTML_PATH;
  if(htmlPath){
    const html = await fs.readFile(htmlPath, 'utf8');
    const results = parseSerp(html);
    return { query:q, results, proxy:{ enabled:false }, traceFile:null };
  }
  const vendorCli = path.join(__dirname, '..', 'google-search', 'cli.js');
  try{
    await fs.access(vendorCli);
    const stdout = await new Promise((resolve, reject)=>{
      execFile('node', [vendorCli, q], { env:process.env, maxBuffer:10*1024*1024 }, (err, out)=>{
        if(err) return reject(err);
        resolve(out);
      });
    });
    const parsed = JSON.parse(stdout);
    return { query:q, url:parsed.url, results:parsed.results, proxy:parsed.proxy, traceFile:null };
  }catch{
    // fallback to local engine
  }
  const engine = await BrowserEngine.create();
  const page = await engine.newPage();
  const url = buildGoogleUrl({ q, hl:opts.hl, gl:opts.gl, num:opts.num, start:opts.start });
  await page.goto(url, { waitUntil:'domcontentloaded' });
  await acceptConsent(page);
  await page.waitForSelector('#search');
  const html = await page.content();
  const results = parseSerp(html);
  const out = { query:q, url, results, proxy:engine.proxy, traceFile:engine.traceFile };
  await engine.close();
  return out;
}

module.exports = { search, buildGoogleUrl, parseSerp, acceptConsent };
