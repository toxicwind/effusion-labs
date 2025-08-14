import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { rmSync, readFileSync } from 'node:fs';
import path from 'node:path';

const outDir = 'tmp/sparks-status-test';
const buildCmd = `npx @11ty/eleventy --quiet --input=src --output=${outDir}`;
rmSync(outDir, { recursive: true, force: true });

test('spark listings reveal status text', () => {
  execSync(buildCmd, { stdio: 'inherit' });
  const htmlPath = path.join(outDir, 'sparks', 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  assert.match(html, /\[draft\]/);
});
