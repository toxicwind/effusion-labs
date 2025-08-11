const { setGlobalDispatcher, ProxyAgent } = require('undici');

function truthy(value){
  return ['1','true','TRUE'].includes(String(value));
}

async function configureProxyFromEnv(env = process.env){
  let server = env.http_proxy || env.https_proxy || env.OUTBOUND_PROXY_URL;
  if(!server){
    if(truthy(env.OUTBOUND_PROXY_ENABLED)){
      return { enabled:false, reason:'missing_url' };
    }
    return { enabled:false };
  }
  if(!/^https?:\/\//.test(server)) server = 'http://' + server;
  const url = new URL(server);
  let auth = 'absent';
  if(env.OUTBOUND_PROXY_USER){
    url.username = env.OUTBOUND_PROXY_USER;
    if(env.OUTBOUND_PROXY_PASS){
      url.password = env.OUTBOUND_PROXY_PASS;
      auth = 'present';
    } else {
      auth = 'username_only';
    }
  }
  setGlobalDispatcher(new ProxyAgent(url.toString()));
  return { enabled:true, server:url.host, auth };
}

module.exports = { configureProxyFromEnv };
