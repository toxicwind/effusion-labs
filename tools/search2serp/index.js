const { fetch: undiciFetch, ProxyAgent } = require('undici');
const { JSDOM } = require('jsdom');

function buildProxy(host, opts={}){
  const envEnabled = process.env.OUTBOUND_PROXY_ENABLED === '1';
  const envUrl = process.env.OUTBOUND_PROXY_URL;
  const envUser = process.env.OUTBOUND_PROXY_USER;
  const envPass = process.env.OUTBOUND_PROXY_PASS;
  const envBypass = (process.env.OUTBOUND_PROXY_NO_PROXY || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  const enabled = opts.forceProxy===true ? true : opts.forceProxy===false ? false : envEnabled;
  const bypass = (opts.noProxyHosts?opts.noProxyHosts.split(','):envBypass).map(s=>s.trim().toLowerCase()).filter(Boolean);
  const shouldBypass = bypass.some(h=>host===h || host.endsWith('.'+h));
  const useProxy = enabled && envUrl && !shouldBypass;
  const state = { enabled: useProxy, via: envUrl, auth: (envUser&&envPass)?'present':'absent', bypass };
  if(!useProxy) return { state };
  const uri = `http://${envUrl}`;
  const auth = envUser && envPass ? `${envUser}:${envPass}` : undefined;
  const dispatcher = new ProxyAgent({ uri, auth });
  return { state, dispatcher };
}

async function ddgSearch(query, pages, dispatcher){
  const results=[];
  for(let i=0;i<pages;i++){
    const s=i*50;
    const url=`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${s}`;
    const res = await undiciFetch(url,{dispatcher});
    const html = await res.text();
    const dom = new JSDOM(html);
    dom.window.document.querySelectorAll('.result__a').forEach(a=>{
      results.push({ title:a.textContent.trim(), url:a.href });
    });
  }
  return results;
}

async function search(query, opts={}){
  const engine = opts.engine || 'ddg';
  const pages = Number(opts.pages||1);
  const host = engine==='ddg'? 'duckduckgo.com' : 'google.com';
  const { state, dispatcher } = buildProxy(host, opts);
  let results=[];
  if(engine==='ddg') results = await ddgSearch(query,pages,dispatcher);
  return { results, proxy: state };
}

module.exports={ search };
