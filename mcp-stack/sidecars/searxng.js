import { fetch } from 'undici';
import { log } from '../gateway/logger.js';

export async function resolveSearxng() {
  const url = process.env.SEARXNG_ENGINE_URL || 'http://searxng:8080';
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) return { enabled: true, url };
  } catch (err) {
    log('warn', 'searxng', 'unreachable', { err: err.message });
  }
  return { enabled: false, reason: 'unreachable' };
}
