import { fetch } from 'undici';

function resolveUrl(input){
  let url = input;
  if(!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const u = new URL(url);
  if((u.username || u.password)){
    const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if(u.protocol !== 'https:' && !isLocal){
      throw new Error('refusing to send credentials over insecure transport');
    }
  }
  return u.toString();
}

export async function fetchMarkdown(url) {
  const gateway = process.env.OUTBOUND_MARKDOWN_URL || 'http://localhost:5000';
  const apiKey = process.env.OUTBOUND_MARKDOWN_API_KEY || '';
  const finalUrl = resolveUrl(url);
  const timeout = Number(process.env.OUTBOUND_MARKDOWN_TIMEOUT || '120000');
  const res = await fetch(`${gateway}/convert`,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify({ url: finalUrl }),
    signal: AbortSignal.timeout(timeout)
  });
  if(!res.ok) throw new Error('gateway_error:'+res.status);
  return res.json();
}

export default { fetchMarkdown };
