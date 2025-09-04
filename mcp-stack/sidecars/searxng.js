import fetch from 'node-fetch';

export async function resolveSearxng() {
  const url = process.env.SEARXNG_ENGINE_URL;
  if (!url) {
    return { enabled: false, reason: 'SEARXNG_ENGINE_URL not set' };
  }
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return { enabled: true, url };
    return { enabled: false, reason: `status ${res.status}` };
  } catch (e) {
    return { enabled: false, reason: 'unreachable' };
  }
}
