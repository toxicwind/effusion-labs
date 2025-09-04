import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await test('interlinker unresolved report emits JSON array', () => {
  const p = 'artifacts/reports/interlinker-unresolved.json';
  assert.ok(fs.existsSync(p), 'report file missing');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(Array.isArray(data), 'report not array');
  if (data.length) {
    const e = data[0];
    assert.ok('kind' in e && 'key' in e && 'sourcePage' in e);
  }
});

