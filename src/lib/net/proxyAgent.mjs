import { setGlobalDispatcher, ProxyAgent, Agent } from 'undici'
import { loadOutboundProxy } from './outboundProxy.mjs'

function isLocalhost(target) {
  try {
    const { hostname } = new URL(target)
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  } catch {
    return false
  }
}

export async function configureProxyFromEnv(env = process.env, targetUrl) {
  const proxy = loadOutboundProxy(env)
  if (targetUrl && isLocalhost(targetUrl)) {
    setGlobalDispatcher(new Agent())
    return { enabled: false, reason: 'localhost' }
  }
  if (proxy.enabled) {
    setGlobalDispatcher(new ProxyAgent(proxy.url))
    return { enabled: true, server: new URL(proxy.url).host }
  }
  setGlobalDispatcher(new Agent())
  return { enabled: false }
}

export default { configureProxyFromEnv }
