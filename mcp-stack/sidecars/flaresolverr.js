import fetch from 'node-fetch';

export async function resolveFlaresolverr() {
  const url = process.env.FLARESOLVERR_URL;
  if (!url) return { available: false };
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return { available: true, url };
    return { available: false };
  } catch {
    return { available: false };
  }
}
