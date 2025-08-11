import fs from 'fs';
import path from 'path';

const stateDir = path.join(process.cwd(), 'tmp');
if(!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, {recursive:true});
const persistedStatePath = path.join(stateDir, 'pw-state.json');
const cfFlagFile = path.join(stateDir, 'cf-flag.json');

function isCloudflareChallenge(input){
  if(!input) return false;
  const html = typeof input === 'string' ? input : input.body || '';
  const headers = input.headers || {};
  if(headers['cf-mitigated'] === 'challenge') return true;
  if(/__cf_bm/.test(headers['set-cookie'] || '')) return true;
  return /Just a moment/i.test(html) || /cdn-cgi\/challenge-platform/.test(html);
}

function realisticHeaders(){
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.60 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1'
  };
}

function fingerprintOptions(){
  return {
    timezoneId: 'America/Denver',
    viewport: { width:1920, height:1080 },
    colorScheme: 'light',
    locale: 'en-US',
    permissions: []
  };
}

function markChallenge(){
  fs.writeFileSync(cfFlagFile, JSON.stringify({ detected: Date.now() }));
}

function shouldHeadful(retries=0){
  let detected=false;
  try{
    const data = JSON.parse(fs.readFileSync(cfFlagFile,'utf8'));
    detected = Date.now() - data.detected < 24*3600*1000;
  }catch{}
  return detected || retries>1;
}

export { isCloudflareChallenge, realisticHeaders, fingerprintOptions, persistedStatePath, shouldHeadful, markChallenge };
