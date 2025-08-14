const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { CONCEPTS_DIR } = require('../lib/constants');

test('block-ledger concept entry exists with heading', () => {
  const file = path.join(CONCEPTS_DIR, 'block-ledger.md');
  assert.ok(fs.existsSync(file), 'block-ledger concept is missing');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let idx = 0;
  if (lines[0] === '---') {
    idx = lines.indexOf('---', 1) + 1;
  }
  const first = lines.slice(idx).find(l => l.trim());
  assert.ok(first && first.startsWith('# '), 'block-ledger concept lacks heading');
});
