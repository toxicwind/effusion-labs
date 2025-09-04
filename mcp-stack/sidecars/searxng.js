export function resolveSearxng(){
  const url=process.env.SEARXNG_ENGINE_URL;
  if(url){return {url, enabled:true};}
  return {enabled:false, reason:'SEARXNG_ENGINE_URL not set'};
}
