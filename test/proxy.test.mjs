import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProxyFromEnv } from '../tools/shared/proxy.mjs';

test('proxy disabled returns disabled state', () => {
  const { state, config } = buildProxyFromEnv({ OUTBOUND_PROXY_ENABLED:'0' });
  assert.equal(state.enabled, false);
  assert.equal(config, undefined);
});

test('http_proxy ignored when not explicitly enabled', () => {
  const { state } = buildProxyFromEnv({ http_proxy:'http://example:8080' });
  assert.equal(state.enabled, false);
});

test('proxy enabled without auth', () => {
  const env = { OUTBOUND_PROXY_ENABLED:'1', OUTBOUND_PROXY_URL:'http://example:8080' };
  const { state, config } = buildProxyFromEnv(env);
  assert.equal(state.enabled, true);
  assert.equal(state.server, env.OUTBOUND_PROXY_URL);
  assert.equal(state.auth, 'absent');
  assert.deepEqual(config, { server:env.OUTBOUND_PROXY_URL });
});

test('proxy enabled with auth', () => {
  const env = { OUTBOUND_PROXY_ENABLED:'true', OUTBOUND_PROXY_URL:'http://example:8080', OUTBOUND_PROXY_USER:'u', OUTBOUND_PROXY_PASS:'p' };
  const { state, config } = buildProxyFromEnv(env);
  assert.equal(state.auth, 'present');
  assert.equal(config.username, 'u');
  assert.equal(config.password, 'p');
});
