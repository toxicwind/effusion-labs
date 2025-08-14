import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
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
  srv = http
    .createServer((req, res) => {
      const file = path.join('_site', req.url);
      try {
        const data = fs.readFileSync(file);
        const ext = path.extname(file);
        const type =
          ext === '.png'
            ? 'image/png'
            : ext === '.avif'
            ? 'image/avif'
            : ext === '.webp'
            ? 'image/webp'
            : 'application/octet-stream';
        res.setHeader('content-type', type);
        res.end(data);
      } catch {
        res.statusCode = 404;
        res.end();
      }
    })
    .listen(3333);
});

after(() => {
  srv.close();
});

test('logo served from assets', async () => {
  const res = await fetchFn('http://localhost:3333/assets/logo.png');
  assert.equal(res.status, 200);
});

test('generated avif and webp have correct MIME', async () => {
  const avifRes = await fetchFn(`http://localhost:3333${avifPath}`);
  assert.match(avifRes.headers.get('content-type') || '', /image\/avif/);
  const webpRes = await fetchFn(`http://localhost:3333${webpPath}`);
  assert.match(webpRes.headers.get('content-type') || '', /image\/webp/);
});
