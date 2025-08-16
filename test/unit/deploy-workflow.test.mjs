import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');

test('deploy workflow triggers on pull_request', () => {
  assert.match(workflow, /on:\s*\n(?:[\s\S]*?)pull_request:/, 'pull_request trigger missing');
});

test('build job runs only on push events', () => {
  assert.match(workflow, /build:\n\s+if: github\.event_name == 'push'/, 'build job missing push-only condition');
});
