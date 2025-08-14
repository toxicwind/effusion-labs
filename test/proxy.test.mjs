import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOutboundProxy } from '../lib/outboundProxy.js';

test('proxy disabled returns disabled state', () => {
  const state = loadOutboundProxy({ OUTBOUND_PROXY_ENABLED:'0' });
  assert.equal(state.enabled, false);
});

test('proxy enabled without auth', () => {
  const env = { OUTBOUND_PROXY_ENABLED:'1', OUTBOUND_PROXY_URL:'http://example:8080' };
  const state = loadOutboundProxy(env);
  assert.equal(state.enabled, true);
  assert.equal(state.url, env.OUTBOUND_PROXY_URL);
  assert.equal(state.auth, 'absent');
});

test('proxy enabled with auth', () => {
  const env = { OUTBOUND_PROXY_ENABLED:'true', OUTBOUND_PROXY_URL:'http://example:8080', OUTBOUND_PROXY_USER:'u', OUTBOUND_PROXY_PASS:'p' };
  const state = loadOutboundProxy(env);
  assert.equal(state.auth, 'present');
  assert.equal(state.url, 'http://u:p@example:8080');
});
