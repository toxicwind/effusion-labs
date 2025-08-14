import test from 'node:test';
import assert from 'node:assert';
import { rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dateToRfc822 = require('@11ty/eleventy-plugin-rss/src/dateRfc822.js');

const outDir = 'tmp/test-feed-build';

rmSync(outDir, { recursive: true, force: true });

test('feed exposes build metadata', () => {
  execSync(`npx @11ty/eleventy --quiet --input=src --output=${outDir}`, { stdio: 'inherit' });
  const xml = readFileSync(path.join(outDir, 'feed.xml'), 'utf8');
  const hash = execSync('git rev-parse --short HEAD').toString().trim();
  const ts = Number(execSync('git log -1 --format=%ct').toString().trim()) * 1000;
  const expectedDate = dateToRfc822(ts);
  assert.match(xml, new RegExp(`<!-- build: ${hash} -->`));
  assert.match(xml, new RegExp(`<lastBuildDate>${expectedDate}</lastBuildDate>`));
});
