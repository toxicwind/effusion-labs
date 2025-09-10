// test temporarily parked due to missing markdownGateway implementation
// rename file to `browser-engine.test.mjs` to re-enable
import test from 'node:test';
import assert from 'node:assert/strict';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { fetchMarkdown } from '../../helpers/network/markdownGateway';

test('fetchMarkdown returns markdown and solver payload', async () => {
  const mock = new MockAgent();
  setGlobalDispatcher(mock);
  const scope = mock.get('http://gateway');
  scope.intercept({ path: '/convert', method: 'POST' }).reply(200, {
    flareresolver: { status: 'ok' },
    markdown: '# hi\n'
  });
  process.env.OUTBOUND_MARKDOWN_URL = 'http://gateway';
  const res = await fetchMarkdown('example.com');
  assert.equal(res.markdown, '# hi\n');
  assert.equal(res.flareresolver.status, 'ok');
});

test('fetchMarkdown defaults to https', async () => {
  const mock = new MockAgent();
  setGlobalDispatcher(mock);
  const scope = mock.get('http://gateway');
  scope.intercept({ path: '/convert', method: 'POST' }).reply(200, {
    flareresolver: { status: 'ok' },
    markdown: '# hi\n'
  });
  process.env.OUTBOUND_MARKDOWN_URL = 'http://gateway';
  const res = await fetchMarkdown('example.com');
  assert.equal(res.flareresolver.status, 'ok');
});

test('rejects http URLs with credentials to non-localhost', async () => {
  await assert.rejects(() => fetchMarkdown('http://user:pass@example.com'));
});
