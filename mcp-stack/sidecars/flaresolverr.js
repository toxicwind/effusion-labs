export function resolveFlareSolverr(){
  const url=process.env.FLARESOLVERR_URL;
  if(url){return {url};}
  return null;
}
