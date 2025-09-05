#!/usr/bin/env node
// tools/unresolved-summary.mjs
// Emit a compact Markdown table summarizing unresolved wikilinks.
// Usage:
//   node tools/unresolved-summary.mjs [path]
// Tip (GitHub Actions):
//   node tools/unresolved-summary.mjs >> "$GITHUB_STEP_SUMMARY"

import fs from 'node:fs';
import path from 'node:path';

const p = process.argv[2] || path.join('artifacts', 'reports', 'interlinker-unresolved.json');
if (!fs.existsSync(p)) {
  console.log('### Interlinker Unresolved\n');
  console.log('_No unresolved report found at_ `' + p + '`');
  process.exit(0);
}
const rep = JSON.parse(fs.readFileSync(p, 'utf8'));
const items = Array.isArray(rep.items) ? rep.items : [];

console.log('### Interlinker Unresolved');
console.log();
console.log(`Generated: ${rep.generatedAt}  `);
console.log(`Count: ${rep.count}`);
console.log();
if (!items.length) {
  console.log('No unresolved links.');
  process.exit(0);
}
console.log('| Kind | Key | Source | Attempted | When |');
console.log('|---|---|---|---|---|');
for (const it of items.slice(0, 100)) {
  const attempted = Array.isArray(it.attemptedKinds) ? it.attemptedKinds.join(', ') : '';
  const src = it.sourcePage || '';
  console.log(`| ${it.kind || ''} | ${String(it.key || '').replaceAll('|','&#124;')} | ${src.replaceAll('|','&#124;')} | ${attempted.replaceAll('|','&#124;')} | ${it.when || ''} |`);
}

