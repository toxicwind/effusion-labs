function truthy(value){
  return ['1','true','TRUE'].includes(String(value));
}

function buildProxyFromEnv(env = process.env){
  if(!truthy(env.OUTBOUND_PROXY_ENABLED)){
    return { state:{ enabled:false } };
  }
  let url = env.OUTBOUND_PROXY_URL;
  if(!url){
    return { state:{ enabled:false, reason:'missing_url' } };
  }
  if(!/^https?:\/\//.test(url)) url = 'http://' + url;
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
  return { config, state:{ enabled:true, server:url, auth } };
}

export { buildProxyFromEnv };
