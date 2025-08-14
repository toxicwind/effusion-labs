const fs = require('fs/promises');
const { request } = require('../../lib/flareClient');
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
  const url = buildGoogleUrl({ q, hl:opts.hl, gl:opts.gl, num:opts.num, start:opts.start });
  const res = await request.get(url);
  const results = parseSerp(res.body);
  return { query:q, url, results, proxy:{ enabled:true }, traceFile:null };
}

module.exports = { search, buildGoogleUrl, parseSerp, acceptConsent };
