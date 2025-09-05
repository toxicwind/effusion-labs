#!/usr/bin/env node
// tools/verify-patch-applied.mjs
// Verifies that Interlinker plugin hotfix patches are present before running Eleventy.

import fs from 'node:fs';
import path from 'node:path';

const PKG = '@photogabble/eleventy-plugin-interlinker';
const MOD_DIR = path.join('node_modules', PKG);
const SENTINEL = 'ARACA-INTERLINKER-HOTFIX-V3';

function die(msg) {
  console.error(`❌ Patch verification failed: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function main() {
  const pkgPath = path.join(MOD_DIR, 'package.json');
  const pkgRaw = read(pkgPath);
  if (!pkgRaw) die(`Missing ${pkgPath}`);
  const pkg = JSON.parse(pkgRaw);
  const esmRel = (pkg?.exports && (pkg.exports.import || pkg.module)) || 'index.js';
  const cjsRel = (pkg?.exports && (pkg.exports.require || pkg.main)) || 'index.cjs';
  const esmPath = path.join(MOD_DIR, esmRel);
  const cjsPath = path.join(MOD_DIR, cjsRel);
  const srcUtil = path.join(MOD_DIR, 'src', 'util.js');

  const esm = read(esmPath) || '';
  const cjs = read(cjsPath) || '';
  const util = read(srcUtil) || '';

  const hints = [
    ['util.js sentinel', util.includes(SENTINEL)],
    ['cjs toHtmlString()', /function\s+toHtmlString\s*\(/.test(cjs)],
    ['cjs safeMatch()', /function\s+safeMatch\s*\(/.test(cjs)],
    ['esm imports util', /from\s+['"]\.\/src\/markdown-ext\.js/.test(esm) || /from\s+['"]\.\/src\//.test(esm)],
  ];

  const missing = hints.filter(([, ok]) => !ok);
  if (missing.length) {
    console.error('— Details:');
    for (const [name] of missing) console.error(`   • missing ${name}`);
    die(`Interlinker ${PKG} does not appear patched with input coercion guards.`);
  }

  ok(`Interlinker patches present (sentinel='${SENTINEL}').`);
}

main();

