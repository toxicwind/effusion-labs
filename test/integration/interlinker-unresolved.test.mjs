import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await test('interlinker unresolved report has stable schema v1', () => {
  const p = 'artifacts/reports/interlinker-unresolved.json';
  assert.ok(fs.existsSync(p), 'report file missing');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(data.schemaVersion, 1);
  assert.ok(typeof data.generatedAt === 'string' && /Z$/.test(data.generatedAt), 'generatedAt must be ISO string');
  assert.ok(Number.isInteger(data.count) && data.count >= 0, 'count must be integer');
  assert.ok(Array.isArray(data.items), 'items must be array');
  if (data.items.length) {
    const e = data.items[0];
    for (const k of ['kind','key','sourcePage','guessedKind','attemptedKinds','when']) {
      assert.ok(k in e, `missing field in item: ${k}`);
    }
  }
});
