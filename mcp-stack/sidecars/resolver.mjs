import { log } from '../gateway/logger.mjs'

const defaults = {
  searxng: 'http://searxng:8080',
  flaresolverr: 'http://flaresolverr:8191',
}

export function resolveSidecar(kind, env = process.env) {
  const key = kind.toLowerCase()
  if (key === 'searxng') {
    const url = env.SEARXNG_ENGINE_URL || defaults.searxng
    // In a non-DNS environment we don't verify reachability here.
    return {
      kind: 'searxng',
      url,
      state: env.SEARXNG_ENGINE_URL ? 'env' : 'dns',
    }
  }
  if (key === 'flaresolverr') {
    const url = env.FLARESOLVERR_URL || defaults.flaresolverr
    return {
      kind: 'flaresolverr',
      url,
      state: env.FLARESOLVERR_URL ? 'env' : 'dns',
    }
  }
  log('warn', 'sidecar', 'unknown kind', { kind })
  return { kind, url: null, state: 'disabled' }
}
