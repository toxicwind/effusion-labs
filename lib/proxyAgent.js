const { setGlobalDispatcher, ProxyAgent, Agent } = require('undici');
const { loadOutboundProxy } = require('./outboundProxy');

function isLocalhost(target){
  try{
    const { hostname } = new URL(target);
    return ['localhost','127.0.0.1','::1'].includes(hostname);
  }catch{
    return false;
  }
}

async function configureProxyFromEnv(env = process.env, targetUrl){
  const proxy = loadOutboundProxy(env);
  if(targetUrl && isLocalhost(targetUrl)){
    setGlobalDispatcher(new Agent());
    return { enabled:false, reason:'localhost' };
  }
  if(proxy.enabled){
    setGlobalDispatcher(new ProxyAgent(proxy.url));
    return { enabled:true, server:new URL(proxy.url).host };
  } else {
    setGlobalDispatcher(new Agent());
    return { enabled:false };
  }
}

module.exports = { configureProxyFromEnv };
