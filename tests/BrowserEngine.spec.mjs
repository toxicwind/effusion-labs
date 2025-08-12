import { test, expect } from '@playwright/test';
import { BrowserEngine } from '../tools/shared/BrowserEngine.mjs';
import fs from 'fs/promises';

process.env.OUTBOUND_PROXY_ENABLED = '0';
delete process.env.CHAIN_PROXY_URL;

const popmartUrl = 'https://www.popmart.com/us/products/1061/THE-MONSTERS-FALL-IN-WILD-SERIES-Vinyl-Plush-Doll-Pendant';

// Test 1: Engine Initialization (Proxy Disabled)
test('Engine initializes without proxy and applies stealth', async () => {
  const engine = await BrowserEngine.create();
  expect(engine.proxy.enabled).toBe(false);
  const page = await engine.newPage();
  await page.goto('about:blank');
  const webdriver = await page.evaluate(() => navigator.webdriver);
  expect(webdriver).toBeFalsy();
  await engine.close();
});

// Test 2: Engine Initialization (Proxy Enabled)
test('Engine honors outbound proxy settings', async () => {
  const originalEnabled = process.env.OUTBOUND_PROXY_ENABLED;
  const originalUrl = process.env.OUTBOUND_PROXY_URL;
  const originalChain = process.env.CHAIN_PROXY_URL;
  delete process.env.CHAIN_PROXY_URL;
  process.env.OUTBOUND_PROXY_ENABLED = '1';
  process.env.OUTBOUND_PROXY_URL = 'example:8080';
  const engine = await BrowserEngine.create();
  expect(engine.proxy.enabled).toBe(true);
  expect(engine.proxy.server).toBe('http://example:8080');
  await engine.close();
  process.env.OUTBOUND_PROXY_ENABLED = originalEnabled;
  if(originalUrl !== undefined) process.env.OUTBOUND_PROXY_URL = originalUrl;
  else delete process.env.OUTBOUND_PROXY_URL;
  if(originalChain !== undefined) process.env.CHAIN_PROXY_URL = originalChain;
});

// Test 3: Simple Content Retrieval
test('Retrieves page content', async () => {
  const engine = await BrowserEngine.create();
  const page = await engine.newPage();
  await page.goto('https://the-monsters.fandom.com/wiki/Labubu');
  const heading = await page.locator('h1').innerText();
  expect(heading).toContain('Labubu');
  await engine.close();
});

// Test 4: Session Persistence
test('Persists session state across instances', async () => {
  const engine1 = await BrowserEngine.create();
  const page1 = await engine1.newPage();
  await page1.goto(popmartUrl);
  const accept = page1.locator('button:has-text("Accept")').first();
  if (await accept.isVisible().catch(()=>false)) {
    await accept.click();
  }
  await engine1.saveState('session.json');
  await engine1.close();

  const engine2 = await BrowserEngine.fromState('session.json');
  const page2 = await engine2.newPage();
  await page2.goto(popmartUrl);
  const acceptAgain = page2.locator('button:has-text("Accept")').first();
  await expect(acceptAgain).toHaveCount(0);
  await engine2.close();
  await fs.unlink('session.json');
});

// Test 5: Complex Interaction
test('Extracts first Yahoo Auctions result title', async () => {
  const engine = await BrowserEngine.create();
  const page = await engine.newPage();
  await page.goto('https://auctions.yahoo.co.jp/search/search?p=TIME+TO+CHILL');
  await page.waitForSelector('h3 a');
  const title = await page.locator('h3 a').first().innerText();
  expect(title.trim().length).toBeGreaterThan(0);
  await engine.close();
});
