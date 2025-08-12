import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import os from 'os';
import path from 'path';
import { realisticHeaders, fingerprintOptions } from './cf.mjs';
import { buildProxyFromEnv } from './proxy.mjs';

chromium.use(StealthPlugin());

class BrowserEngine{
  static async create(opts={}){
    const { statePath, headless=true, jitter=false } = opts;
    const launchOpts = { headless };
    const { state: proxyState, config: proxyConfig } = buildProxyFromEnv();
    if(proxyState.enabled){
      launchOpts.proxy = { server: proxyConfig.server };
    }
    const fp = fingerprintOptions(jitter);
    launchOpts.args = ['--disable-blink-features=AutomationControlled'];
    const browser = await chromium.launch(launchOpts);
    const ctxOpts = { ignoreHTTPSErrors:true, ...fp };
    if(statePath) ctxOpts.storageState = statePath;
    const context = await browser.newContext(ctxOpts);
    const traceFile = path.join(os.tmpdir(), `trace-${Date.now()}.zip`);
    await context.tracing.start({ screenshots:true, snapshots:true });
    const engine = new BrowserEngine(browser, context, proxyState, traceFile, statePath);
    return engine;
  }

  static async fromState(path, opts={}){
    return BrowserEngine.create({ ...opts, statePath: path });
  }

  constructor(browser, context, proxy, traceFile, statePath){
    this.browser = browser;
    this.context = context;
    this.proxy = proxy;
    this.traceFile = traceFile;
    this.statePath = statePath;
  }

  async newPage(){
    const page = await this.context.newPage();
    await page.setExtraHTTPHeaders(realisticHeaders());
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    return page;
  }

  async saveState(file){
    await this.context.storageState({ path: file });
  }

  async close(){
    await this.context.tracing.stop({ path: this.traceFile });
    if(this.statePath) await this.saveState(this.statePath);
    await this.context.close();
    await this.browser.close();
  }
}

export { BrowserEngine };
