import test from 'node:test';
import assert from 'node:assert';
import { rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const outDir = 'tmp/test-build';

rmSync(outDir, { recursive: true, force: true });

// Build the site and ensure primary navigation exposes an accessible landmark label
// This reflects the "Semantics" mode with trait emphasis on meta-as-content and legibility

test('home page header includes primary nav landmark', () => {
  execSync('npx @11ty/eleventy --quiet --input=src --output=' + outDir, { stdio: 'inherit' });
  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const matches = [...html.matchAll(/<nav[^>]*aria-label="Primary navigation"/g)];
  assert.equal(matches.length, 2); // mobile dropdown and desktop menu
});
