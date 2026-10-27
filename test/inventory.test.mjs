import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

function load() {
  return JSON.parse(fs.readFileSync('docs/reports/assets-inventory.json', 'utf8'));
}

test('inventory has no duplicate hashes and files exist', () => {
  const data = load();
  const map = new Map();
  for (const e of data) {
    const arr = map.get(e.hash) || [];
    arr.push(e.path);
    map.set(e.hash, arr);
    assert.ok(fs.existsSync(e.path), `${e.path} missing`);
  }
  for (const arr of map.values()) {
    assert.strictEqual(arr.length, 1, `duplicate detected for ${arr[0]}`);
  }
});
