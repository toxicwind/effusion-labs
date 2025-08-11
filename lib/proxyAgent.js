const { setGlobalDispatcher, ProxyAgent, Agent } = require('undici');

async function configureProxyFromEnv(env = process.env){
  const url = env.CHAIN_PROXY_URL;
  if(url){
    setGlobalDispatcher(new ProxyAgent(url));
    return { enabled:true, server:new URL(url).host };
  } else {
    setGlobalDispatcher(new Agent());
    return { enabled:false };
  }
}

module.exports = { configureProxyFromEnv };
