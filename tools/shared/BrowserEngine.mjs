import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { buildProxyFromEnv } from './proxy.mjs';
import { realisticHeaders, fingerprintOptions, persistedStatePath, shouldHeadful } from './cf.mjs';

chromium.use(StealthPlugin());

class BrowserEngine{
  static async create(opts={}){
    const statePath = opts.statePath || persistedStatePath;
    const { state:proxyState, config:proxyConfig } = buildProxyFromEnv();
    const launchOpts = { headless: !shouldHeadful(opts.retry || 0) };
    if(proxyConfig) launchOpts.proxy = proxyConfig;
    console.log(`BrowserEngine proxy: ${proxyState.enabled ? proxyState.server : 'none'} (auth:${proxyState.auth || 'none'})`);
    const browser = await chromium.launch(launchOpts);
    const ctxOpts = { ignoreHTTPSErrors:true, ...fingerprintOptions() };
    if(statePath && fs.existsSync(statePath)) ctxOpts.storageState = statePath;
    const context = await browser.newContext(ctxOpts);
    const traceFile = path.join(os.tmpdir(), `trace-${Date.now()}.zip`);
    await context.tracing.start({ screenshots:true, snapshots:true });
    const engine = new BrowserEngine(browser, context, proxyState, traceFile);
    return engine;
  }

  static async fromState(path, opts={}){
    return BrowserEngine.create({ ...opts, statePath: path });
  }

  constructor(browser, context, proxy, traceFile){
    this.browser = browser;
    this.context = context;
    this.proxy = proxy;
    this.traceFile = traceFile;
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
    try{
      await this.saveState(persistedStatePath);
    }catch{}
    await this.context.tracing.stop({ path: this.traceFile });
    await this.context.close();
    await this.browser.close();
  }
}

export { BrowserEngine };
