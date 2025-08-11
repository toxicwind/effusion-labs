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
  process.env.OUTBOUND_PROXY_ENABLED='1';
  process.env.OUTBOUND_PROXY_URL='http://proxy:8080';
  const engine = await BrowserEngine.create();
  assert.equal(received.proxy.server, 'http://proxy:8080');
  await engine.close();
  chromium.launch = originalLaunch;
});
