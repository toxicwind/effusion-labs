import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const fetchFn = global.fetch;

test('dev server serves CSS with text/css MIME type', async () => {
  const srv = spawn('./node_modules/.bin/eleventy', ['--serve'], { stdio: 'ignore', detached: true });
  await wait(8000);
  const res = await fetchFn('http://localhost:8080/assets/css/app.css');
  assert.match(res.headers.get('content-type') || '', /text\/css/);
  process.kill(-srv.pid, 'SIGKILL');
});
