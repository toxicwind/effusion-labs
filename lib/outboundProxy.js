function truthy(value){
  return ['1','true','TRUE'].includes(String(value));
}

function loadOutboundProxy(env = process.env){
  if(!truthy(env.OUTBOUND_PROXY_ENABLED)){
    return { enabled:false };
  }
  let url = env.OUTBOUND_PROXY_URL;
  if(!url){
    return { enabled:false, reason:'missing_url' };
  }
  if(!/^https?:\/\//.test(url)) url = 'http://' + url;
  let authState = 'absent';
  if(env.OUTBOUND_PROXY_USER){
    const user = encodeURIComponent(env.OUTBOUND_PROXY_USER);
    const pass = env.OUTBOUND_PROXY_PASS ? encodeURIComponent(env.OUTBOUND_PROXY_PASS) : '';
    const creds = pass ? `${user}:${pass}` : user;
    url = url.replace(/^(https?:\/\/)(.*)$/,'$1'+creds+'@$2');
    authState = pass ? 'present' : 'username_only';
  }
  return { enabled:true, url, auth:authState };
}

module.exports = { loadOutboundProxy };
