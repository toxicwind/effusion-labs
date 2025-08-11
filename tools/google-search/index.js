import { BrowserEngine } from '../shared/BrowserEngine.mjs';
import { buildGoogleUrl } from '../search2serp/url.js';
import { parseSerp } from '../search2serp/parser.js';
import { acceptConsent } from '../search2serp/consent.js';

export async function search(q, opts={}){
  const engine = await BrowserEngine.create();
  const page = await engine.newPage();
  const url = buildGoogleUrl({ q, hl:opts.hl, gl:opts.gl, num:opts.num, start:opts.start });
  await page.goto(url, { waitUntil:'domcontentloaded' });
  await acceptConsent(page);
  await page.waitForSelector('#search');
  const html = await page.content();
  const results = parseSerp(html);
  const out = { query:q, url, results, proxy:engine.proxy };
  await engine.close();
  return out;
}
