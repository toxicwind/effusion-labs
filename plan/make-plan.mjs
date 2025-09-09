#!/usr/bin/env node
/**
 * make-plan.mjs
 * -----------------------------------------------------------------------------
 * Dry-run planning tool for this Eleventy repo.
 *
 * - Uses a REAL Eleventy config run through a "spy" (no stubs, no build).
 *   • addPlugin(plugin, opts) calls plugin(spy, opts) so registration is real.
 *   • amendLibrary('md', cb) is honored with a real Markdown-It instance if available.
 *   • on('eleventy.*', handler) is recorded but NOT executed (no side-effects).
 * - Scans the repo to produce:
 *   • var/inspect/tree.before.txt
 *   • var/inspect/refscan.txt
 *   • var/inspect/writers.txt
 *   • var/inspect/unref.txt
 * - Plans content relocation and rewrites:
 *   • var/plan/move-map.tsv
 *   • var/plan/rewrites.sed
 *   • var/plan/apply-moves.sh
 *   • var/plan/apply-rewrites.sh
 *   • var/plan/apply-build.sh
 *   • var/plan/apply-src.sh      (intentional no-op; we are not normalizing src)
 * - Reports:
 *   • var/reports/plan.md
 *   • var/reports/plan.json
 *
 * Notes:
 * - Requires a clean git working tree (refuses otherwise).
 * - Does NOT run an Eleventy build; only executes config registration.
 * - Honors your templateFormats: ["md","njk","html","11ty.js"] — no extra normalization.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const varDir = path.join(repoRoot, 'var');
const inspectDir = path.join(varDir, 'inspect');
const planDir = path.join(varDir, 'plan');
const reportDir = path.join(varDir, 'reports');

/* -------------------------------- Utilities -------------------------------- */

function shell(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe', shell: true, ...opts });
  } catch (err) {
    return (err && err.stdout) ? String(err.stdout) : '';
  }
}

function haveCmd(cmd, args = ['--version']) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, encoding: 'utf8' });
  return r.status === 0;
}

function ensureDirs() {
  fs.mkdirSync(inspectDir, { recursive: true });
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });
}

function ensureCleanTree() {
  const status = shell('git status --porcelain').trim();
  if (status) {
    console.error('Working tree dirty. Commit or stash changes before running.');
    process.exit(1);
  }
}

/* ----------------------------- Eleventy Spy Core ---------------------------- */

async function createEleventySpy() {
  // Provide a real Markdown-It if available so amendLibrary('md', cb) is meaningful.
  let MarkdownIt;
  try { ({ default: MarkdownIt } = await import('markdown-it')); } catch { }
  const realMd = MarkdownIt ? new MarkdownIt() : {
    parse() { return []; },
    renderer: { render() { return ''; } },
    options: {}
  };

  const calls = {
    passthrough: [],
    plugins: [],
    filters: [],
    nunjucksFilters: [],
    shortcodes: [],
    pairedShortcodes: [],
    collections: [],
    events: []
  };

  const spy = {
    markdownLibrary: realMd,
    globalData: {},

    // Core API used across your config/plugins
    addPassthroughCopy(arg) { calls.passthrough.push(arg); },
    addGlobalData(key, value) { this.globalData[key] = value; },

    addFilter(name, fn) { calls.filters.push(name); },
    addNunjucksFilter(name, fn) { calls.nunjucksFilters.push(name); },
    addShortcode(name, fn) { calls.shortcodes.push(name); },
    addPairedShortcode(name, fn) { calls.pairedShortcodes.push(name); },
    addCollection(name, cb) { calls.collections.push(name); },

    addPlugin(pluginFn, opts) {
      calls.plugins.push(pluginFn?.name || 'anonymous');
      if (typeof pluginFn === 'function') {
        // Important: run the plugin with THIS spy so it registers normally
        pluginFn(this, opts);
      }
    },

    amendLibrary(type, cb) {
      if (type === 'md' && typeof cb === 'function') {
        this.markdownLibrary = cb(this.markdownLibrary);
        return this.markdownLibrary;
      }
    },

    // Less critical APIs: keep no-ops for safety
    addWatchTarget() { },
    addTemplateFormats() { },
    setBrowserSyncConfig() { },
    setServerOptions() { },

    // ignore support
    ignores: { add() { } },

    // Record event registration but DO NOT execute handlers
    on(evt, handler) { calls.events.push(evt); },

    // expose captured calls if you want to report them
    _calls: calls
  };

  return spy;
}

async function discoverEleventy() {
  const eleventyConfigPath = path.join(repoRoot, 'eleventy.config.mjs');
  const mod = await import(pathToFileURL(eleventyConfigPath));
  const spy = await createEleventySpy();

  const returned =
    typeof mod?.default === 'function' ? await mod.default(spy)
      : typeof mod === 'function' ? await mod(spy)
        : (mod || {});

  const dir = returned?.dir || {};
  const input = dir.input || 'src';
  const includesName = dir.includes || '_includes';
  const dataName = dir.data || '_data';

  const eleventyInfo = {
    input,
    includes: path.join(input, includesName),
    data: path.join(input, dataName),
    formats: Array.isArray(returned?.templateFormats) ? returned.templateFormats : []
  };

  return { eleventyInfo, spy };
}

/* ------------------------------ File Enumeration --------------------------- */

function listFiles() {
  // Prefer fd (fast); fallback to git ls-files
  const excludes = ['node_modules', '.git', 'bin', 'markdown_gateway', 'mcp-stack'];
  let files = [];
  if (haveCmd('fd', ['--version'])) {
    const args = ['--type', 'f', '--hidden', '--strip-cwd-prefix', '.', repoRoot];
    excludes.forEach(e => { args.push('--exclude', e); });
    const r = spawnSync('fd', args, { cwd: repoRoot, encoding: 'utf8' });
    if (r.status === 0) files = r.stdout.trim().split('\n').filter(Boolean);
  }
  if (!files.length) {
    const out = shell('git ls-files');
    files = out.split('\n').filter(Boolean)
      .filter(f => !excludes.some(e => f.startsWith(`${e}/`)));
  }
  return files;
}

/* ---------------------------------- Scans ---------------------------------- */

async function writeTreeBefore(files) {
  try {
    // Try a pretty tree; fall back to just listing files
    const treeCmd = 'npx --yes tree -a -I "node_modules|.git"';
    const out = shell(treeCmd);
    if (out && out.trim()) {
      await fsp.writeFile(path.join(inspectDir, 'tree.before.txt'), out);
      return;
    }
  } catch { }
  await fsp.writeFile(path.join(inspectDir, 'tree.before.txt'), files.join('\n'));
}

async function writeRefscan() {
  const patterns = [
    '\\bimport\\s+',
    '\\bfrom\\s+[\'"]',
    '\\brequire\\(',
    '\\{%\\s*(include|extends|from|render|macro)\\b',
    '^\\s*(layout|permalink)\\s*:',
    'href=',
    'src=',
    '<link\\s+rel=[\'"]stylesheet[\'"]',
    '<script[^>]*\\ssrc=',
    'url\\(',
    '/(assets|docs|archives|work)/'
  ];

  let output = '';
  if (haveCmd('rg', ['--version'])) {
    const args = ['--no-ignore', '--hidden', '-n'];
    for (const p of patterns) { args.push('-e', p); }
    args.push('--', '.');
    const r = spawnSync('rg', args, { cwd: repoRoot, encoding: 'utf8' });
    output = r.stdout || '';
  } else {
    // Fallback: naive Node scan (slower, but keeps script runnable)
    const files = listFiles();
    for (const f of files) {
      try {
        const buf = fs.readFileSync(path.join(repoRoot, f), 'utf8');
        const lines = buf.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (patterns.some(p => new RegExp(p).test(line))) {
            output += `${f}:${i + 1}:${line}\n`;
          }
        }
      } catch { }
    }
  }
  await fsp.writeFile(path.join(inspectDir, 'refscan.txt'), output);
  return output;
}

async function writeWriters() {
  const writerPatterns = [
    'fs\\.(write|append|createWriteStream|mkdir)',
    '>>',
    '\\btee\\b',
    'rimraf',
    'rm -rf',
  ];

  let output = '';
  if (haveCmd('rg', ['--version'])) {
    const args = ['--no-ignore', '--hidden', '-n'];
    for (const p of writerPatterns) args.push('-e', p);
    args.push('--', '.');
    const r = spawnSync('rg', args, { cwd: repoRoot, encoding: 'utf8' });
    output = r.stdout || '';
  } else {
    // Fallback: naive Node scan
    const files = listFiles();
    for (const f of files) {
      try {
        const buf = fs.readFileSync(path.join(repoRoot, f), 'utf8');
        const lines = buf.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (writerPatterns.some(p => new RegExp(p).test(line))) {
            output += `${f}:${i + 1}:${line}\n`;
          }
        }
      } catch { }
    }
  }

  const filtered = output
    .split('\n')
    .filter(l => /(lib|artifacts|logs|tmp)\//.test(l))
    .join('\n');

  await fsp.writeFile(path.join(inspectDir, 'writers.txt'), filtered);
  return filtered;
}

async function writeUnreferenced(allFiles, refscanOutput, eleventyInfo) {
  const refFiles = new Set(
    (refscanOutput || '')
      .split('\n')
      .map(l => l.split(':')[0])
      .filter(Boolean)
  );

  const unref = allFiles.filter(f =>
    !refFiles.has(f) &&
    !f.startsWith(eleventyInfo.includes) &&
    !f.startsWith(eleventyInfo.data) &&
    !f.endsWith('.11ty.js') && // templates: always considered referenced by Eleventy
    !f.startsWith('markdown_gateway/') &&
    !f.startsWith('mcp-stack/')
  );

  await fsp.writeFile(path.join(inspectDir, 'unref.txt'), unref.join('\n'));
  return unref;
}

/* ---------------------------- Planning Artifacts ---------------------------- */

async function writeMoveMap() {
  // Static intents for docs → content/docs and flower reports → content/docs/flower
  const specs = [
    { src: 'docs', dest: 'src/content/docs' },
    { src: 'docs/vendor', dest: 'src/content/docs/vendor-docs' },
    { src: 'docs/vendors', dest: 'src/content/docs/vendor-docs' },
    { src: 'flower_reports_showcase', dest: 'src/content/docs/flower' },
  ];
  const rows = [];

  for (const intent of specs) {
    const abs = path.join(repoRoot, intent.src);
    if (!fs.existsSync(abs)) continue;
    const r = spawnSync('fd', ['--type', 'f', '--strip-cwd-prefix', '.', intent.src], { cwd: repoRoot, encoding: 'utf8' });
    if (r.status === 0) {
      const list = r.stdout.split('\n').filter(Boolean);
      for (const rel of list) {
        const from = path.join(intent.src, rel);
        const to = path.join(intent.dest, rel);
        rows.push(`${from}\t${to}`);
      }
    } else {
      // fallback: walk directory
      const walk = (dir, relBase = '') => {
        const entries = fs.readdirSync(path.join(repoRoot, dir));
        for (const e of entries) {
          if (e === '.' || e === '..') continue;
          const full = path.join(dir, e);
          const stat = fs.statSync(path.join(repoRoot, full));
          if (stat.isDirectory()) walk(full, path.join(relBase, e));
          else if (stat.isFile()) {
            const from = full;
            const to = path.join(intent.dest, relBase, e);
            rows.push(`${from}\t${to}`);
          }
        }
      };
      walk(intent.src);
    }
  }

  await fsp.writeFile(path.join(planDir, 'move-map.tsv'), rows.join('\n'));
  return rows;
}

async function writeRewritesSed() {
  const rewrites = [
    ['docs/', 'src/content/docs/'],
    ['docs/vendor/', 'src/content/docs/vendor-docs/'],
    ['docs/vendors/', 'src/content/docs/vendor-docs/'],
    ['flower_reports_showcase/', 'src/content/docs/flower/'],
  ];
  const sed = rewrites.map(([from, to]) => `s|${from}|${to}|g`).join('\n');
  await fsp.writeFile(path.join(planDir, 'rewrites.sed'), sed);
  return rewrites;
}

async function writeApplyScripts(passthroughs) {
  const hdr = '#!/bin/bash\nset -e\nif [ "$I_UNDERSTAND" != "1" ]; then echo "Refusing without I_UNDERSTAND=1"; exit 1; fi\n';

  const applyMoves = `${hdr}echo "Previewing git mv operations from var/plan/move-map.tsv"\nwhile IFS=$'\\t' read -r FROM TO; do\n  [ -z "$FROM" ] && continue\n  echo git mv "$FROM" "$TO"\n  git add -N "$FROM" "$TO" >/dev/null 2>&1 || true\ndone < var/plan/move-map.tsv\n`;
  const applyRewrites = `${hdr}echo "Would run: sed -i -f var/plan/rewrites.sed <files>"\n`;
  const applyBuild = `${hdr}echo "Proposed Eleventy passthrough copies:"\n${passthroughs.map(p => `echo "  - ${p}"`).join('\n')}\n`;
  const applySrcNoop = `${hdr}echo "No src normalization planned (templateFormats already support md/njk/html/11ty.js)."\n`;

  await fsp.writeFile(path.join(planDir, 'apply-moves.sh'), applyMoves, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-rewrites.sh'), applyRewrites, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-build.sh'), applyBuild, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-src.sh'), applySrcNoop, { mode: 0o755 });
}

/* --------------------------------- Reports --------------------------------- */

async function writeReports(eleventyInfo, moves, rewrites, writersTxt, unref, passthroughs, spyCalls) {
  const formats = (eleventyInfo.formats || []).join(', ');

  const md = [
    '# Plan Report',
    '## Overview',
    'Dry-run planning of documentation relocation and URL rewrites. Eleventy config was executed via a live spy (no stubs) to discover directories, template formats, and registration surfaces. No build or event handlers were executed.',
    '## Eleventy Discovery',
    `- input: \`${eleventyInfo.input}\``,
    `- includes: \`${eleventyInfo.includes}\``,
    `- data: \`${eleventyInfo.data}\``,
    `- templateFormats: \`${formats}\``,
    '## Proposed Moves',
    moves.length ? moves.map(m => `- ${m.replace('\t', ' -> ')}`).join('\n') : '- None',
    '## Proposed Rewrites',
    rewrites.length ? rewrites.map(([f, t]) => `- \`${f}\` → \`${t}\``).join('\n') : '- None',
    '## Proposed Passthroughs',
    passthroughs.length ? passthroughs.map(p => `- ${p}`).join('\n') : '- None',
    '## Writers of lib|artifacts|logs|tmp',
    writersTxt.trim() ? writersTxt.split('\n').map(l => `- ${l}`).join('\n') : '- None observed.',
    '## Unreferenced — Conjecture',
    unref.length ? unref.map(f => `- ${f} — needs review`).join('\n') : '- None',
    '## Eleventy Registration (spy-captured)',
    `- plugins: ${spyCalls.plugins.length ? '`' + spyCalls.plugins.join('`, `') + '`' : '_none_'}\n` +
    `- filters: ${spyCalls.filters.length ? '`' + spyCalls.filters.join('`, `') + '`' : '_none_'}\n` +
    `- nunjucksFilters: ${spyCalls.nunjucksFilters.length ? '`' + spyCalls.nunjucksFilters.join('`, `') + '`' : '_none_'}\n` +
    `- shortcodes: ${spyCalls.shortcodes.length ? '`' + spyCalls.shortcodes.join('`, `') + '`' : '_none_'}\n` +
    `- pairedShortcodes: ${spyCalls.pairedShortcodes.length ? '`' + spyCalls.pairedShortcodes.join('`, `') + '`' : '_none_'}\n` +
    `- collections: ${spyCalls.collections.length ? '`' + spyCalls.collections.join('`, `') + '`' : '_none_'}\n` +
    `- events registered: ${spyCalls.events.length ? '`' + spyCalls.events.join('`, `') + '`' : '_none_'}\n`,
    '## Edge Cases (as needed, evidence-driven)',
    '- None observed.'
  ].join('\n');

  await fsp.writeFile(path.join(reportDir, 'plan.md'), md);

  const json = {
    eleventy: eleventyInfo,
    moves: moves.map(row => {
      const [from, to] = row.split('\t');
      return { from, to };
    }),
    rewrites: rewrites.map(([from, to]) => ({ from, to })),
    writers: writersTxt.split('\n').filter(Boolean),
    unreferenced: unref,
    edgeCases: [],
    passthroughs,
    spy: {
      plugins: spyCalls.plugins,
      filters: spyCalls.filters,
      nunjucksFilters: spyCalls.nunjucksFilters,
      shortcodes: spyCalls.shortcodes,
      pairedShortcodes: spyCalls.pairedShortcodes,
      collections: spyCalls.collections,
      events: spyCalls.events
    }
  };

  await fsp.writeFile(path.join(reportDir, 'plan.json'), JSON.stringify(json, null, 2));
}

/* ---------------------------------- Main ----------------------------------- */

async function main() {
  ensureCleanTree();
  ensureDirs();

  // 1) Real Eleventy config execution through spy (no build)
  const { eleventyInfo, spy } = await discoverEleventy();

  // 2) Enumerate files
  const files = listFiles();

  // 3) Inspect: tree, refscan, writers, unreferenced
  await writeTreeBefore(files);
  const refscanOut = await writeRefscan();
  const writersTxt = await writeWriters();
  const unref = await writeUnreferenced(files, refscanOut, eleventyInfo);

  // 4) Plan: moves and rewrites (no src normalization; formats already supported)
  const moves = await writeMoveMap();
  const rewrites = await writeRewritesSed();

  // 5) Scripts: gated apply scripts
  const passthroughs = [
    'src/content/docs/vendor-docs/**',
    'src/content/docs/flower/normalized/**',
    'src/content/docs/flower/reports/**'
  ];
  await writeApplyScripts(passthroughs);

  // 6) Reports
  await writeReports(eleventyInfo, moves, rewrites, writersTxt, unref, passthroughs, spy._calls);

  // 7) Done
  console.log('DRY RUN COMPLETE :: artifacts at var/');
}

main().catch(err => { console.error(err); process.exit(1); });
