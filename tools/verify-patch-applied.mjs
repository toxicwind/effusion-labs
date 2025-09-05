#!/usr/bin/env node
// tools/verify-patch-applied.mjs
// Fails CI if the Interlinker hotfix is not present in node_modules.

import fs from 'node:fs';
import path from 'node:path';

const SENTINEL = 'Patched-By: ARACA-INTERLINKER-HOTFIX-V3';

function fail(msg) {
  console.error(`\n[verify-patch-applied] ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[verify-patch-applied] ${msg}`);
}

const pkgDir = path.join('node_modules', '@photogabble', 'eleventy-plugin-interlinker');
const targets = [
  path.join(pkgDir, 'index.cjs'),
  path.join(pkgDir, 'src', 'util.js'),
  path.join(pkgDir, 'src', 'wikilink-parser.js'),
  path.join(pkgDir, 'src', 'html-link-parser.js'),
  path.join(pkgDir, 'src', 'interlinker.js'),
  path.join(pkgDir, 'src', 'markdown-ext.js'),
  path.join(pkgDir, 'src', 'resolvers.js'),
];

if (!fs.existsSync(pkgDir)) fail(`Package directory not found: ${pkgDir}. Run 'npm ci' before verification.`);

let missing = [];
for (const file of targets) {
  if (!fs.existsSync(file)) { missing.push(file + ' (missing)'); continue; }
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(SENTINEL)) missing.push(file);
}

if (missing.length) {
  fail(
    'Required patch sentinel not found in:\n' +
    missing.map(f => ` - ${f}`).join('\n') +
    `\n\nHints:\n` +
    ` - Ensure 'patches/' is copied before 'npm ci' in the Docker deps stage.\n` +
    ` - Ensure postinstall runs patch-package (PATCH_PACKAGE_RUN!=0) or run 'npx patch-package' explicitly.\n`
  );
}

ok('All target files contain sentinel; Interlinker hotfix is applied.');

