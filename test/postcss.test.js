const assert = require('node:assert');
const { test } = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const runPostcss = require('../lib/postcss');

/** Helper to create a temp directory */
function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'css-'));
}

test('runPostcss processes CSS with configured plugins', async () => {
  const dir = tmp();
  const src = path.join(dir, 'in.css');
  const dest = path.join(dir, 'out.css');
  fs.writeFileSync(src, 'a{color:blue}');
  await runPostcss(src, dest);
  const out = fs.readFileSync(dest, 'utf8');
  assert.ok(out.includes('color:blue'));
});
