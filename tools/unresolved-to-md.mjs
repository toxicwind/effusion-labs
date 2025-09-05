#!/usr/bin/env node
// tools/unresolved-to-md.mjs
// Render a compact Markdown summary table from unresolved report for PR descriptions.

import fs from 'node:fs';
import path from 'node:path';

const p = path.join('artifacts','reports','interlinker-unresolved.json');
if (!fs.existsSync(p)) {
  console.log('No unresolved report found.');
  process.exit(0);
}
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const rows = Array.isArray(j.items) ? j.items.slice(0, 25) : [];
console.log(`\nUnresolved Wikilinks Summary`);
console.log(`\nCount: ${j.count} (showing up to ${rows.length})\n`);
console.log('| kind | key | guessedKind | attemptedKinds | sourcePage | when |');
console.log('|---|---|---|---|---|---|');
for (const it of rows) {
  const kinds = Array.isArray(it.attemptedKinds) ? it.attemptedKinds.join(',') : '';
  console.log(`| ${it.kind} | ${it.key} | ${it.guessedKind || ''} | ${kinds} | ${it.sourcePage || ''} | ${it.when} |`);
}

