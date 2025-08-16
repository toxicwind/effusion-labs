import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const KEEPALIVE_IMPORT = '--import=./test/setup/llm-keepalive.mjs';

// Acceptance example: the keepalive module emits a heartbeat
await test('keepalive emits heartbeat to stderr', async () => {
  const { stderr, status } = spawnSync(
    process.execPath,
    [KEEPALIVE_IMPORT, '-e', 'setTimeout(() => {}, 6000)'],
    { env: { ...process.env, LLM_HEARTBEAT_SECS: '5' } },
  );
  assert.equal(status, 0);
  assert.match(stderr.toString(), /LLM-safe: tests alive/);
});

// Property: the first SIGINT is ignored and the second exits with code 130
await test('keepalive ignores first SIGINT', async () => {
  const { status } = spawnSync(
    process.execPath,
    [
      KEEPALIVE_IMPORT,
      '-e',
      'process.kill(process.pid,"SIGINT"); setTimeout(()=>{ process.kill(process.pid,"SIGINT"); },100); setTimeout(()=>{},200);',
    ],
  );
  assert.equal(status, 130);
});
