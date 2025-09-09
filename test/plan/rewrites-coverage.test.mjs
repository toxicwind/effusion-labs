import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

function ensurePlan(){
  if (!fs.existsSync('var/plan/rewrites.sed')) {
    execSync('node plan/make-plan.mjs', {encoding:'utf8'});
  }
}

test('rewrites spec has required pairs and publicUrlChanges empty', () => {
  const spec = JSON.parse(fs.readFileSync('plan/rewrites.spec.json','utf8'));
  const pairs = spec.pairs.map(p => p.join('->'));
  ['docs/->src/content/docs/',
   'docs/vendor/->src/content/docs/vendor-docs/',
   'docs/vendors/->src/content/docs/vendor-docs/',
   'flower_reports_showcase/->src/content/docs/flower/'].forEach(p => assert.ok(pairs.includes(p)));
  assert.deepStrictEqual(spec.publicUrlChanges, []);
});

test('rewrites.sed compiles required pairs', () => {
  ensurePlan();
  const sed = fs.readFileSync('var/plan/rewrites.sed','utf8');
  ['s|docs/|src/content/docs/|g',
   's|docs/vendor/|src/content/docs/vendor-docs/|g',
   's|docs/vendors/|src/content/docs/vendor-docs/|g',
   's|flower_reports_showcase/|src/content/docs/flower/|g'].forEach(r => assert.ok(sed.includes(r)));
});
