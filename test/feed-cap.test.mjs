import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

function build() {
  execSync('npx @11ty/eleventy', { stdio: 'inherit' });
}

test('RSS feed capped at 20 items', () => {
  build();
  const xml = fs.readFileSync('_site/feed.xml', 'utf8');
  const items = (xml.match(/<item>/g) || []).length;
  assert.ok(items <= 20, `Expected no more than 20 items, got ${items}`);
});
