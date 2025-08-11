const assert = require('node:assert');
const { test } = require('node:test');
const { buildArchiveNav } = require('../lib/archive-nav');

test('buildArchiveNav reflects directory structure', () => {
  const nav = buildArchiveNav();
  assert.ok(nav['/archives/'].some((i) => i.url === '/archives/collectables/'));
  assert.ok(
    nav['/archives/collectables/'].some((i) => i.url === '/archives/collectables/designer-toys/')
  );
  assert.ok(
    nav['/archives/collectables/designer-toys/'].some(
      (i) => i.url === '/archives/collectables/designer-toys/pop-mart/'
    )
  );
  assert.ok(
    nav['/archives/collectables/designer-toys/pop-mart/'].some(
      (i) => i.url ===
        '/archives/collectables/designer-toys/pop-mart/the-monsters/'
    )
  );
});
