const { setGlobalDispatcher, ProxyAgent, Agent } = require('undici');

function isLocalhost(target){
  try{
    const { hostname } = new URL(target);
    return ['localhost','127.0.0.1','::1'].includes(hostname);
  }catch{
    return false;
  }
}

async function configureProxyFromEnv(env = process.env, targetUrl){
  const url = env.CHAIN_PROXY_URL;
  if(targetUrl && isLocalhost(targetUrl)){
    setGlobalDispatcher(new Agent());
    return { enabled:false, reason:'localhost' };
  }
  if(url){
    setGlobalDispatcher(new ProxyAgent(url));
    return { enabled:true, server:new URL(url).host };
  } else {
    setGlobalDispatcher(new Agent());
    return { enabled:false };
  }
}

module.exports = { configureProxyFromEnv };
