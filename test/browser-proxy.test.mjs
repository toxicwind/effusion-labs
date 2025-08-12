import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-extra';

// Fake browser and context to avoid launching real browsers
class FakeContext {
  constructor(){
    this.tracing = { start: async()=>{}, stop: async()=>{} };
  }
  async newPage(){ return {}; }
  async close(){}
}
class FakeBrowser {
  async newContext(){ return new FakeContext(); }
  async close(){}
}

test('BrowserEngine passes proxy settings to launch', async () => {
  const originalLaunch = chromium.launch;
  let received;
  chromium.launch = async opts => { received = opts; return new FakeBrowser(); };
  const { BrowserEngine } = await import('../tools/shared/BrowserEngine.mjs');
  const originalEnabled = process.env.OUTBOUND_PROXY_ENABLED;
  const originalUrl = process.env.OUTBOUND_PROXY_URL;
  const originalChain = process.env.CHAIN_PROXY_URL;
  delete process.env.CHAIN_PROXY_URL;
  process.env.OUTBOUND_PROXY_ENABLED='1';
  process.env.OUTBOUND_PROXY_URL='http://proxy:8080';
  const engine = await BrowserEngine.create();
  assert.equal(received.proxy.server, 'http://proxy:8080');
  await engine.close();
  chromium.launch = originalLaunch;
  process.env.OUTBOUND_PROXY_ENABLED = originalEnabled;
  if(originalUrl !== undefined) process.env.OUTBOUND_PROXY_URL = originalUrl;
  else delete process.env.OUTBOUND_PROXY_URL;
  if(originalChain !== undefined) process.env.CHAIN_PROXY_URL = originalChain;
});
