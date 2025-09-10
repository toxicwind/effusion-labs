import { fetch, ProxyAgent } from 'undici';
import { loadOutboundProxy } from './outboundProxy.js';

export function __setUndici(u) {
  fetch = u.fetch;
  ProxyAgent = u.ProxyAgent;
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function send(cmd, url, opts={}){
  const proxy = loadOutboundProxy();
  if(!proxy.enabled){
    throw new Error('OUTBOUND_PROXY_ENABLED must be true to use flareClient');
  }
  const agent = new ProxyAgent(proxy.url);
  const timeout = opts.maxTimeout || 60000;
  const body = { cmd, url, ...opts };
  const headers = { 'content-type':'application/json' };
  const delays = [250,500,1000];
  for(let attempt=0; attempt<3; attempt++){
    try{
      const res = await fetch('http://dummy-host/v1', {
        method:'POST',
        body: JSON.stringify(body),
        headers,
        dispatcher: agent,
        signal: AbortSignal.timeout(timeout)
      });
      if(!res.ok || res.status>=500){
        throw new Error('bad_status:'+res.status);
      }
      const json = await res.json();
      const sol = json.solution || {};
      return {
        ok: true,
        status: sol.status || res.status,
        url: sol.url || url,
        contentType: sol.headers ? sol.headers['content-type'] : undefined,
        body: sol.response,
        cookies: sol.cookies || [],
        meta: { id: json.session || json.id }
      };
    }catch(err){
      if(attempt===2) throw err;
      await sleep(delays[attempt]);
    }
  }
}

export const request = {
  get: (url, opts={}) => send('request.get', url, opts),
  post: (url, opts={}) => send('request.post', url, opts),
};

export default { request, __setUndici };
