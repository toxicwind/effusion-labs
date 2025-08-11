import fs from 'node:fs';
import path from 'node:path';

function isCloudflareChallenge(input){
  if(!input) return false;
  const body = typeof input === 'string' ? input : input.body || '';
  const headers = typeof input === 'string' ? {} : input.headers || {};
  const h = Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(), v]));
  return (
    /cf-mitigated:\s*challenge/i.test(body) ||
    /__cf_bm/i.test(body) ||
    /Just a moment/i.test(body) ||
    /\/cdn-cgi\/challenge-platform\//i.test(body) ||
    h['server'] === 'cloudflare'
  );
}

function realisticHeaders(){
  return {
    'accept-language': 'en-US,en;q=0.9',
    'user-agent': fingerprintOptions().userAgent,
  };
}

function fingerprintOptions(jitter=false){
  const baseUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const width = 1280 + (jitter ? Math.floor(Math.random()*20) : 0);
  const height = 800 + (jitter ? Math.floor(Math.random()*20) : 0);
  return { userAgent: baseUA, viewport:{ width, height } };
}

const persistedStatePath = path.join('tmp','pw-state.json');

function shouldHeadful(retries){
  return retries > 0;
}

function markChallenge(){
  const file = path.join('tmp','cf-challenge.log');
  fs.appendFileSync(file, `${new Date().toISOString()} challenge\n`);
}

export { isCloudflareChallenge, realisticHeaders, fingerprintOptions, persistedStatePath, shouldHeadful, markChallenge };
