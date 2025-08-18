import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const banned = [/--silent\b/, /--quiet\b/, /\s-q\b/, /\/dev\/null/];

test('scripts avoid silent operations and /dev/null redirects', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
  for (const [name, cmd] of Object.entries(pkg.scripts)) {
    for (const rule of banned) {
      assert(!rule.test(cmd), `${name} script contains banned pattern: ${rule}`);
    }
  }

  const bootstrap = readFileSync(new URL('../../scripts/llm-bootstrap.sh', import.meta.url), 'utf8');
  for (const rule of banned) {
    assert(!rule.test(bootstrap), `llm-bootstrap.sh contains banned pattern: ${rule}`);
  }
});
