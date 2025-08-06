import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import fs from 'node:fs';
let avifPath;
let webpPath;

const fetchFn = global.fetch;
let srv;

before(async () => {
  spawnSync('npx', ['@11ty/eleventy'], { stdio: 'ignore' });
  const files = fs.readdirSync('_site/assets/images');
  avifPath = `/assets/images/${files.find(f => f.endsWith('.avif'))}`;
  webpPath = `/assets/images/${files.find(f => f.endsWith('.webp'))}`;
  srv = spawn('./node_modules/.bin/eleventy', ['--serve'], { stdio: 'ignore', detached: true });
  await wait(4000);
});

after(() => {
  process.kill(-srv.pid, 'SIGKILL');
});

test('logo served from assets', async () => {
  const res = await fetchFn('http://localhost:8080/assets/logo.png');
  assert.equal(res.status, 200);
});

test('generated avif and webp have correct MIME', async () => {
  const avifRes = await fetchFn(`http://localhost:8080${avifPath}`);
  assert.match(avifRes.headers.get('content-type') || '', /image\/avif/);
  const webpRes = await fetchFn(`http://localhost:8080${webpPath}`);
  assert.match(webpRes.headers.get('content-type') || '', /image\/webp/);
});
