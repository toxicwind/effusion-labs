import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { parseSerp } from '../tools/search2serp/parser.js';

const html = fs.readFileSync('test/fixtures/google-serp.html','utf8');
const expected = JSON.parse(fs.readFileSync('test/fixtures/google-serp.json','utf8'));

test('parses organic results', () => {
  const results = parseSerp(html);
  assert.equal(results.length, 5);
  assert.deepEqual(results, expected);
});
