function truthy(value){
  return ['1','true','TRUE'].includes(String(value));
}

function buildProxyFromEnv(env = process.env){
  const base = env.HTTP_PROXY || env.http_proxy || env.HTTPS_PROXY || env.https_proxy;
  if(!truthy(env.OUTBOUND_PROXY_ENABLED)){
    if(base){
      return { config:{ server:base }, state:{ enabled:false, base } };
    }
    return { state:{ enabled:false } };
  }
  const url = env.OUTBOUND_PROXY_URL;
  if(!url){
    return { state:{ enabled:false, reason:'missing_url', base } };
  }
  const config = { server:url };
  let auth = 'absent';
  if(env.OUTBOUND_PROXY_USER){
    config.username = env.OUTBOUND_PROXY_USER;
    if(env.OUTBOUND_PROXY_PASS){
      config.password = env.OUTBOUND_PROXY_PASS;
      auth = 'present';
    } else {
      auth = 'username_only';
    }
  }
  return { config, state:{ enabled:true, server:url, auth, base } };
}

export { buildProxyFromEnv };
