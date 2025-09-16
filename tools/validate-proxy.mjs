#!/usr/bin/env node
import { request, __setUndici } from '../src/lib/net/flareClient.mjs'
import { MockAgent, fetch } from 'undici'

if (process.env.MOCK_PROXY_HEALTH) {
  const mock = new MockAgent()
  mock.disableNetConnect()
  const client = mock.get('http://dummy-host')
  client.intercept({ path: '/v1', method: 'POST' }).reply(200, {
    solution: {
      status: 200,
      url: 'https://example.org',
      response: 'ok',
      headers: { 'content-type': 'text/plain' },
      cookies: [],
    },
  })
  class FakeProxyAgent {
    dispatch(opts, handler) {
      return mock.dispatch(opts, handler)
    }
  }
  __setUndici({ fetch, ProxyAgent: FakeProxyAgent })
}

try {
  const res = await request.get('https://example.org')
  if (res.ok) {
    console.log('status:"ok"')
  } else {
    console.log('status:"fail"')
    process.exit(1)
  }
} catch (err) {
  console.log('status:"fail"', err.message)
  process.exit(1)
}
