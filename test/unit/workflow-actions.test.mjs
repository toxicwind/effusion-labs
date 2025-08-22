import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const deploy = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');

function assertNoLegacyActions(workflow) {
  assert.doesNotMatch(workflow, /actions\/checkout@v[0-3]/);
  assert.doesNotMatch(workflow, /actions\/setup-node@v[0-3]/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact@v[0-3]/);
}

test('GitHub workflows use latest action versions', () => {
  [deploy].forEach(assertNoLegacyActions);
});
