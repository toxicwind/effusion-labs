#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';

function run(cmd, args, opts={}){
  const res = spawnSync(cmd, args, { encoding:'utf8', ...opts });
  if(res.status !== 0){
    const err = new Error(res.stderr || res.stdout || `${cmd} exited ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.stdout;
}

async function ensureDeps(){
  try{ require.resolve('playwright-extra'); }
  catch{
    run('npm',['install'],{stdio:'inherit'});
  }
  run('npx',['playwright','install-deps','chromium'],{stdio:'inherit'});
  run('npx',['playwright','install','chromium'],{stdio:'inherit'});
}

function buildProxyUrl(){
  const { OUTBOUND_PROXY_URL:host, OUTBOUND_PROXY_USER:user, OUTBOUND_PROXY_PASS:pass } = process.env;
  if(!host) throw new Error('OUTBOUND_PROXY_URL missing');
  const auth = user ? `${user}:${pass || ''}@` : '';
  return `http://${auth}${host}`;
}

async function checkIp(proxyUrl){
  const { address:expected } = await lookup('mildlyawesome.com');
  const ip = run('curl',['-s','--proxy',proxyUrl,'https://checkip.amazonaws.com']);
  const val = ip.trim();
  if(val !== expected){
    throw new Error(`proxy ip ${val} did not match expected ${expected}`);
  }
  return val;
}

function runSearch(query){
  const out = run('node',['tools/search2serp/cli.js', query]);
  return JSON.parse(out);
}

function verifySerp(res, link){
  const ok = Array.isArray(res.results) && res.results.some(r=>r.url===link);
  if(!ok) throw new Error('expected link not found in SERP');
}

function runWeb2md(url){
  const out = run('node',['webpage-to-markdown.js', url]);
  return out;
}

async function main(){
  await ensureDeps();
  const proxyUrl = buildProxyUrl();
  const ip = await checkIp(proxyUrl);
  console.log('proxy ip', ip);
  const query = 'pop mart monsters time to chill site:popmart.com';
  const link = 'https://www.popmart.com/products/labubu-time-to-chill-vinyl-plush-doll';
  const serp = runSearch(query);
  verifySerp(serp, link);
  console.log('serp ok');
  const md = runWeb2md(link);
  if(!md.includes('October 31, 2022')){
    throw new Error('missing expected date in page');
  }
  console.log('web2md ok');
}

main().catch(err=>{ console.error(err.message); process.exit(1); });
