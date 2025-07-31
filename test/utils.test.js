const assert = require('node:assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');
const { readFileCached } = require('../lib/utils');

test('readFileCached returns updated content when file changes', t => {
  const tmp = path.join(__dirname, 'tmp.txt');
  fs.writeFileSync(tmp, 'one');
  const first = readFileCached(tmp);
  fs.writeFileSync(tmp, 'two');
  // ensure mtime difference for file cache
  const now = Date.now() + 1000;
  fs.utimesSync(tmp, now / 1000, now / 1000);
  const second = readFileCached(tmp);
  fs.unlinkSync(tmp);
  assert.strictEqual(first, 'one');
  assert.strictEqual(second, 'two');
});
