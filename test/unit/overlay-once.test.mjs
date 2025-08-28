import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import vm from 'node:vm';

// Helper: run the overlay script inside a controlled vm context
function runOverlayInJsdom(html = '') {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url: 'https://example.org/',
    pretendToBeVisual: true,
  });

  const { window } = dom;
  const { document } = window;

  // Deterministic randomness to avoid baseline collisions during composeInitial
  const rng = () => 0; // always pick first option

  // Minimal stubs
  const perf = { now: () => 0 };

  // requestAnimationFrame: call once for boot, ignore subsequent calls (avoids tick loop)
  let rafCalls = 0;
  const raf = (cb) => { rafCalls += 1; if (rafCalls === 1) cb(0); return rafCalls; };

  // Basic storage shim
  const storage = (() => { const m = new Map(); return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k)
  }; })();

  // IntersectionObserver stub capturing last instance
  let lastIO = null;
  class IO {
    constructor(cb, _opts) { this.cb = cb; this.targets = new Set(); this.unobs = new Map(); lastIO = this; }
    observe(t) { this.targets.add(t); }
    unobserve(t) { this.targets.delete(t); this.unobs.set(t, (this.unobs.get(t) || 0) + 1); }
    disconnect() { this.targets.clear(); }
    trigger(target, isIntersecting = true) { this.cb([{ target, isIntersecting }], this); }
  }

  // Compute style stub
  const gcs = () => ({ getPropertyValue: () => '' });

  // Navigator with saveData to skip GPU init
  const nav = { connection: { saveData: true, effectiveType: '4g' }, hardwareConcurrency: 8 };

  // Prime document ready state as complete so overlay boots immediately
  Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });

  // Build the vm context
  const ctx = {
    window, document,
    innerWidth: 1280, innerHeight: 800,
    devicePixelRatio: 1,
    navigator: nav,
    performance: perf,
    requestAnimationFrame: raf,
    cancelAnimationFrame: () => {},
    localStorage: storage,
    getComputedStyle: gcs,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    IntersectionObserver: IO,
    location: window.location,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    setTimeout,
    clearTimeout,
  };

  vm.createContext(ctx);
  // Override Math.random within the context (built-in Math is not enumerable on global)
  ctx.__rng = rng;
  vm.runInContext('Math.random = globalThis.__rng;', ctx);
  const code = fs.readFileSync('src/scripts/mschf-overlay.js', 'utf8');
  vm.runInContext(code, ctx, { filename: 'mschf-overlay.js' });

  return { window, document, get lastIO() { return lastIO; } };
}

test('overlay section mounts fire only once per target', () => {
  const html = `
    <section class="hero">hero</section>
    <div class="map-cta">cta</div>
    <div class="work-feed">feed</div>
  `;
  const { document, lastIO } = runOverlayInJsdom(html);

  // Sanity: baseline should have none of the section-driven nodes
  const q = (sel) => document.querySelectorAll(sel).length;
  assert.equal(q('.mschf-rings'), 0);
  assert.equal(q('.mschf-quotes'), 0);
  assert.equal(q('.mschf-plate'), 0);
  assert.equal(q('.mschf-stickers'), 0);
  assert.equal(q('.mschf-dims'), 0);

  const hero = document.querySelector('.hero');
  const cta  = document.querySelector('.map-cta');
  const feed = document.querySelector('.work-feed');
  assert.ok(lastIO, 'IntersectionObserver instance should be created');

  // First intersects
  lastIO.trigger(hero);
  lastIO.trigger(cta);
  lastIO.trigger(feed);

  // Once-only flags set + layer grew
  assert.equal(hero.dataset.mschfSeen, '1');
  assert.equal(cta.dataset.mschfSeen, '1');
  assert.equal(feed.dataset.mschfSeen, '1');
  const layer = document.querySelector('#mschf-overlay-root .mschf-layer');
  const afterFirst = layer ? layer.childElementCount : 0;
  assert.ok(afterFirst > 0, 'first pass should add elements');

  // Repeat intersects: should not create more; unobserve not called again
  lastIO.trigger(hero);
  lastIO.trigger(cta);
  lastIO.trigger(feed);

  const afterSecond = layer ? layer.childElementCount : 0;
  assert.equal(afterSecond, afterFirst, 'second pass should not add more elements');
});
