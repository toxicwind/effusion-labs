import test from 'node:test';
import assert from 'node:assert/strict';
import { request, __setUndici } from '../lib/flareClient.js';
import { MockAgent, fetch } from 'undici';
import { loadOutboundProxy } from '../lib/outboundProxy.js';

const resetEnv = () => {
  delete process.env.OUTBOUND_PROXY_ENABLED;
  delete process.env.OUTBOUND_PROXY_URL;
  delete process.env.OUTBOUND_PROXY_USER;
  delete process.env.OUTBOUND_PROXY_PASS;
};

function setupMock(){
  const mock = new MockAgent();
  mock.disableNetConnect();
  return mock;
}

test('request uses proxy with auth', async () => {
  resetEnv();
  process.env.OUTBOUND_PROXY_ENABLED='1';
  process.env.OUTBOUND_PROXY_URL='http://proxy:8080';
  process.env.OUTBOUND_PROXY_USER='user';
  process.env.OUTBOUND_PROXY_PASS='pass';
  const mock = setupMock();
  let proxyUrl;
  class FakeProxyAgent{
    constructor(url){ proxyUrl = url; }
    dispatch(opts, handler){ return mock.dispatch(opts, handler); }
  }
  const client = mock.get('http://dummy-host');
  client.intercept({ path:'/v1', method:'POST' }).reply(200, { solution:{ status:200, url:'https://example.org', response:'ok', headers:{'content-type':'text/plain'}, cookies:[] } });
  __setUndici({ fetch, ProxyAgent: FakeProxyAgent });
  const res = await request.get('https://example.org');
  assert.equal(res.ok, true);
  assert.equal(res.body, 'ok');
  const state = loadOutboundProxy();
  assert.equal(state.url, 'http://user:pass@proxy:8080');
  assert.equal(proxyUrl, 'http://user:pass@proxy:8080');
});

test('retries on failure', async () => {
  resetEnv();
  process.env.OUTBOUND_PROXY_ENABLED='1';
  process.env.OUTBOUND_PROXY_URL='http://proxy:8080';
  const mock = setupMock();
  class FakeProxyAgent{ dispatch(opts, handler){ return mock.dispatch(opts, handler); } }
  const client = mock.get('http://dummy-host');
  client.intercept({ path:'/v1', method:'POST' }).reply(500, { error:'fail' }).times(2);
  client.intercept({ path:'/v1', method:'POST' }).reply(200, { solution:{ status:200, url:'https://example.org', response:'ok' } });
  __setUndici({ fetch, ProxyAgent: FakeProxyAgent });
  const res = await request.get('https://example.org');
  assert.equal(res.status, 200);
});

test.skip('timeouts are respected', async () => {
  resetEnv();
  process.env.OUTBOUND_PROXY_ENABLED='1';
  process.env.OUTBOUND_PROXY_URL='http://proxy:8080';
  const mock = setupMock();
  class FakeProxyAgent{ dispatch(opts, handler){ return mock.dispatch(opts, handler); } }
  const client = mock.get('http://dummy-host');
  client.intercept({ path:'/v1', method:'POST' }).reply(200, { solution:{ status:200, url:'https://example.org', response:'ok' } }, { delay:20 }).times(3);
  __setUndici({ fetch, ProxyAgent: FakeProxyAgent });
  await assert.rejects(() => request.get('https://example.org', { maxTimeout:10 }));
});

test('normalized shape', async () => {
  resetEnv();
  process.env.OUTBOUND_PROXY_ENABLED='1';
  process.env.OUTBOUND_PROXY_URL='http://proxy:8080';
  const mock = setupMock();
  class FakeProxyAgent{ dispatch(opts, handler){ return mock.dispatch(opts, handler); } }
  const client = mock.get('http://dummy-host');
  const body = { solution:{ status:201, url:'https://example.org', response:'hi', headers:{ 'content-type':'text/html' }, cookies:[{name:'a'}] }, id:'1' };
  client.intercept({ path:'/v1', method:'POST' }).reply(200, body);
  __setUndici({ fetch, ProxyAgent: FakeProxyAgent });
  const res = await request.post('https://example.org', { body:'test' });
  assert.deepEqual(res, { ok:true, status:201, url:'https://example.org', contentType:'text/html', body:'hi', cookies:[{name:'a'}], meta:{ id:'1' } });
});
