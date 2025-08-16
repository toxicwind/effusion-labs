import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');

test('deploy workflow does not trigger on pull_request', () => {
  assert.doesNotMatch(workflow, /pull_request:/, 'pull_request trigger should be absent');
});

test('build job runs only on push events', () => {
  assert.match(workflow, /build:\n\s+if: github\.event_name == 'push'/, 'build job missing push-only condition');
});
