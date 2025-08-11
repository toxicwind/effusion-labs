import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const env = { ...process.env, SEARCH2SERP_HTML_PATH:'test/fixtures/google-serp.html' };

const out = spawnSync('node', ['tools/search2serp/cli.js', 'kittens'], { env });
const stdout = out.stdout.toString();
const data = JSON.parse(stdout);

test('cli returns structured results from fixture', () => {
  assert.equal(data.results.length >= 5, true);
  const first = data.results[0];
  assert.ok(first.title && first.url && first.snippet);
});
