import { fetch } from 'undici';
import { log } from '../gateway/logger.js';

export async function resolveFlareSolverr() {
  const url = process.env.FLARESOLVERR_URL;
  if (!url) return { enabled: false, reason: 'not configured' };
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) return { enabled: true, url };
  } catch (err) {
    log('warn', 'flaresolverr', 'unreachable', { err: err.message });
  }
  return { enabled: false, reason: 'unreachable' };
}
