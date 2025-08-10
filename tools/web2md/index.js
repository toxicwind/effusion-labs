const { fetch: undiciFetch, Agent, ProxyAgent } = require('undici');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter() { return 250 + Math.floor(Math.random()*1250); }

async function resolveDNS(host){
  let A = [], AAAA = [];
  try { A = await dns.resolve4(host); } catch {}
  try { AAAA = await dns.resolve6(host); } catch {}
  return {A, AAAA};
}

function stripTracking(u){
  const url = new URL(u);
  for(const k of [...url.searchParams.keys()]){
    if(/^utm_/.test(k) || k==='fbclid') url.searchParams.delete(k);
  }
  return url.toString();
}

function normalizeHTML(html,url){
  const dom = new JSDOM(html,{url});
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

const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxyDispatcher = proxy ? new ProxyAgent(proxy) : undefined;

async function fetchTier1(url,opts={}){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), opts.timeout||12000);
  try {
    const res = await undiciFetch(url,{signal:controller.signal, headers:opts.headers, dispatcher: proxyDispatcher});
    const buf = await res.arrayBuffer();
    return { status: res.status, body: Buffer.from(buf), headers: Object.fromEntries(res.headers), httpVersion: res.httpVersion || 'h2' };
  } finally { clearTimeout(t); }
}

async function fetchTier2(url,opts={}){
  const inner = new Agent({ connect: { ALPNProtocols: ['http/1.1'] } });
  const agent = proxy ? new ProxyAgent({ uri: proxy, dispatcher: inner }) : inner;
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), opts.timeout||12000);
  try {
    const res = await undiciFetch(url,{signal:controller.signal, dispatcher:agent, headers:opts.headers});
    const buf = await res.arrayBuffer();
    return { status: res.status, body: Buffer.from(buf), headers: Object.fromEntries(res.headers), httpVersion: '1.1' };
  } finally { clearTimeout(t); agent.close(); }
}

async function fetchTier3(url,opts={}){
  const u = new URL(url);
  const lib = u.protocol==='https:'?https:http;
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), opts.timeout||12000);
  return new Promise((resolve,reject)=>{
    const req = lib.request({ hostname:u.hostname, path:u.pathname+u.search, port:u.port, method:'GET', headers:opts.headers, family: opts.family }, res=>{
      const chunks=[];
      res.on('data',d=>chunks.push(d));
      res.on('end',()=>resolve({status:res.statusCode, body:Buffer.concat(chunks), headers:res.headers, httpVersion: res.httpVersion }));
    });
    req.on('error',reject);
    req.on('timeout',()=>{ req.destroy(); reject(new Error('timeout')); });
    req.end();
  }).finally(()=>clearTimeout(t));
}

async function fetchTier4(url,opts={}){
  try {
    const { chromium } = require('playwright-core');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ extraHTTPHeaders: opts.headers });
    await page.goto(url,{ waitUntil:'networkidle', timeout: opts.timeout||12000 });
    const content = await page.content();
    await browser.close();
    return { status:200, body:Buffer.from(content), headers:{}, httpVersion:'browser' };
  } catch(err){
    throw err;
  }
}

async function fetchTier5(url,opts={}){
  const ts = new Date();
  const timestamp = ts.getUTCFullYear().toString();
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${timestamp}0101`;
  const res = await undiciFetch(api);
  const data = await res.json();
  if(data.archived_snapshots && data.archived_snapshots.closest){
    const snapshot = data.archived_snapshots.closest.url;
    const r = await undiciFetch(snapshot,{headers:opts.headers});
    const buf = await r.arrayBuffer();
    return { status:r.status, body:Buffer.from(buf), headers:Object.fromEntries(r.headers), httpVersion: r.httpVersion || 'h1' };
  }
  throw new Error('no snapshot');
}

const tiers=[fetchTier1,fetchTier2,fetchTier3,fetchTier4,fetchTier5];

async function fetchWithFallback(url, options={}){
  const { lang='en', ipv4Only=false, noH2=false, headless=false } = options;
  const headers = { 'User-Agent': 'web2md/1.0', 'Accept-Language': lang };
  const family = ipv4Only?4:undefined;
  const host = new URL(url).hostname;
  const dnsInfo = await resolveDNS(host);
  const diag={ url, host, dns: dnsInfo, attempts: [] };
  const startTime = Date.now();
  let lastError;
  const tierOrder = headless? [3]: (noH2? [0,2,3,4]:[0,1,2,3,4]);
  for(const idx of tierOrder){
    const tierFn = tiers[idx];
    await sleep(jitter());
    try {
      const res = await tierFn(url,{headers, family});
      const end = Date.now();
      const okStatus = res.status >=200;
      const raw = res.body.toString('utf8');
      const md = normalizeHTML(raw,url);
      const rawHash = crypto.createHash('sha256').update(raw).digest('hex');
      const normHash = crypto.createHash('sha256').update(md).digest('hex');
      const sizeOK = raw.length>1024 || md.length>2048;
      diag.attempts.push({ tier: idx+1, status: res.status, httpVersion: res.httpVersion, ms: end-startTime, sizeOK, okStatus });
      if(okStatus && sizeOK){
        return { html: raw, markdown: md, tier: idx+1, hashes:{raw:rawHash, norm:normHash}, headers: res.headers, httpVersion: res.httpVersion, diagnostics: diag };
      } else {
        lastError = new Error('bad status or size');
      }
    } catch(err){
      lastError=err;
      diag.attempts.push({ tier: idx+1, error: err.message });
    }
  }
  throw Object.assign(new Error('all tiers failed'),{diagnostics:diag, lastError});
}

module.exports={ fetchWithFallback };
