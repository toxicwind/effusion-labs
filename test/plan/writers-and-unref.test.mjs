import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

function ensurePlan(){
  if (!fs.existsSync('var/inspect/writers.txt')) {
    execSync('node plan/make-plan.mjs', {encoding:'utf8'});
  }
}

test('writers and unreferenced reported', () => {
  ensurePlan();
  const writers = fs.readFileSync('var/inspect/writers.txt','utf8').trim().split('\n').filter(Boolean);
  assert.ok(writers.some(l => /(lib|artifacts|logs|tmp)\//.test(l)));
  const unref = fs.readFileSync('var/inspect/unref.txt','utf8').trim().split('\n').filter(Boolean);
  const md = fs.readFileSync('var/reports/plan.md','utf8');
  const json = JSON.parse(fs.readFileSync('var/reports/plan.json','utf8'));
  for (const f of unref) {
    assert.ok(md.includes(f) || (json.unreferenced||[]).includes(f));
  }
});
