import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptConsent } from '../tools/search2serp/consent.js';

class FakeLocator {
  constructor(visible){ this.visible = visible; this.clicked = false; }
  first(){ return this; }
  async isVisible(){ return this.visible; }
  async click(){ this.clicked = true; }
}

class FakePage {
  constructor(map){ this.map = map; }
  locator(sel){ return this.map[sel] || new FakeLocator(false); }
}

test('acceptConsent clicks button when present', async () => {
  const page = new FakePage({ '#L2AGLb': new FakeLocator(true) });
  const accepted = await acceptConsent(page);
  assert.equal(accepted, true);
});

test('acceptConsent returns false when absent', async () => {
  const page = new FakePage({});
  const accepted = await acceptConsent(page);
  assert.equal(accepted, false);
});
