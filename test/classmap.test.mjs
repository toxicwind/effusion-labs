import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

test('no old class names remain', () => {
  const map = JSON.parse(fs.readFileSync('docs/migration/class-map.json', 'utf8'));
  for (const oldName of Object.keys(map)) {
    const res = execSync(`rg -l ${JSON.stringify(oldName)} src || true`, { encoding: 'utf8' }).trim();
    assert.strictEqual(res, '', `found old class ${oldName}`);
  }
});
