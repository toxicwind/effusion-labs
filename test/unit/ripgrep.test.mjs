import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));

// Acceptance example: repository does not depend on @vscode/ripgrep
await test('devDependencies omit @vscode/ripgrep', () => {
  assert.ok(!pkg.devDependencies || !pkg.devDependencies['@vscode/ripgrep'],
    'should not depend on @vscode/ripgrep');
});

// Property/contract: prepare-docs script does not auto-install ripgrep
await test('prepare-docs avoids ripgrep install', () => {
  const script = pkg.scripts['prepare-docs'] || '';
  assert.ok(!script.includes('@vscode/ripgrep'), 'prepare-docs should not install ripgrep');
});
