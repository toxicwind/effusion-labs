const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const { baseContentPath } = require('../lib/constants');

test('carbon handshake spark exists and has title', () => {
  const file = fs.readFileSync(path.join(baseContentPath, 'sparks', 'carbon-handshake.md'), 'utf8');
  const fm = matter(file);
  assert.strictEqual(fm.data.title, 'Carbon Handshake');
});
