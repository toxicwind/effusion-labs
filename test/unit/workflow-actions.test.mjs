import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';

const workflowDir = new URL('../../.github/workflows/', import.meta.url);
const workflows = readdirSync(workflowDir)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => readFileSync(new URL(f, workflowDir), 'utf8'));

function assertNoLegacyActions(workflow) {
  assert.doesNotMatch(workflow, /actions\/checkout@v[0-3]/);
  assert.doesNotMatch(workflow, /actions\/setup-node@v[0-3]/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact@v[0-3]/);
}

test('GitHub workflows use latest action versions', () => {
  workflows.forEach(assertNoLegacyActions);
});
