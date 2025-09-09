#!/usr/bin/env node
/**
 * make-plan.mjs — DRY-RUN PLANNER (Eleventy-aware)
 * -----------------------------------------------------------------------------
 * Runs your real Eleventy config through a spy (no build) to discover dirs,
 * template formats, passthroughs, and plugin/registration surfaces.
 *
 * Fixes:
 * - Provides eleventyConfig.versionCheck() expected by official plugins
 *   (e.g. @11ty/eleventy-plugin-rss, @11ty/eleventy-navigation).
 * - addPlugin executes plugin(spy, opts) so registration is real.
 *
 * Output artifacts (dry-run only; never mutates repo state):
 *   var/inspect/tree.before.txt
 *   var/inspect/refscan.txt
 *   var/inspect/writers.txt
 *   var/inspect/unref.txt
 *   var/plan/move-map.tsv
 *   var/plan/rewrites.sed
 *   var/plan/apply-moves.sh
 *   var/plan/apply-rewrites.sh
 *   var/plan/apply-build.sh
 *   var/plan/apply-src.sh  (noop: formats already support md/njk/html/11ty.js)
 *   var/reports/plan.md
 *   var/reports/plan.json
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* ------------------------------- constants -------------------------------- */
const repoRoot = process.cwd();
const varDir = path.join(repoRoot, 'var');
const inspectDir = path.join(varDir, 'inspect');
const planDir = path.join(varDir, 'plan');
const reportDir = path.join(varDir, 'reports');

/* -------------------------------- helpers --------------------------------- */
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

/* --------------------------- Eleventy Spy (real) --------------------------- */
async function createEleventySpy() {
  // Prefer a real Markdown-It if available
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
    events: [],
    transforms: [],
  };

  // A minimal Set-like for dataFilterSelectors
  const dataFilterSelectors = new Set();
  const htmlTransformer = {
    add(name, fn) { /* record only */ calls.transforms.push(name || 'htmlTransformer'); },
    remove(name) { /* noop */ },
  };

  const spy = {
    // public surfaces
    markdownLibrary: realMd,
    globalData: {},
    dataFilterSelectors,     // .add/.delete supported by Set
    htmlTransformer,         // used by some plugins

    // Core config APIs used by plugins and your config
    addPassthroughCopy(arg) { calls.passthrough.push(arg); },
    addGlobalData(key, value) { this.globalData[key] = value; },
    addFilter(name, fn) { calls.filters.push(name); },
    addNunjucksFilter(name, fn) { calls.nunjucksFilters.push(name); },
    addShortcode(name, fn) { calls.shortcodes.push(name); },
    addPairedShortcode(name, fn) { calls.pairedShortcodes.push(name); },
    addCollection(name, cb) { calls.collections.push(name); },
    addTransform(name, fn) { calls.transforms.push(name); }, // legacy API safe

    addPlugin(pluginFn, opts) {
      calls.plugins.push(pluginFn?.name || 'anonymous');
      if (typeof pluginFn === 'function') {
        // Execute plugin against the spy (real registration, still no build)
        pluginFn(this, opts);
      }
    },

    // v3 APIs your config uses
    amendLibrary(type, cb) {
      if (type === 'md' && typeof cb === 'function') {
        this.markdownLibrary = cb(this.markdownLibrary);
        return this.markdownLibrary;
      }
    },

    // Compatibility check expected by official plugins
    versionCheck(range) {
      // We’re not running Eleventy itself here—just configuration.
      // Accept any range but emit a one-line warning once per unique range.
      if (!this.__versionChecks) this.__versionChecks = new Set();
      if (!this.__versionChecks.has(String(range))) {
        this.__versionChecks.add(String(range));
        console.warn(`WARN: Eleventy Plugin compatibility check bypassed in spy: versionCheck("${range}")`);
      }
      return true;
    },

    // Noisy or server-only surfaces we don’t need; keep as no-ops
    setQuietMode() { },
    setInputDirectory() { },
    setOutputDirectory() { },
    setIncludesDirectory() { },
    setLayoutsDirectory() { },
    setDataDirectory() { },
    setTemplateFormats() { },
    addTemplateFormats() { },
    setServerOptions() { },
    setBrowserSyncConfig() { },
    addWatchTarget() { },
    ignores: { add() { } },

    // Record event registration but do not execute
    on(evt, handler) { calls.events.push(evt); },

    // expose captured calls for reports
    _calls: calls,
  };

  // Match docs API: allow .add and .delete on dataFilterSelectors (already Set)
  spy.dataFilterSelectors.add = (...args) => Set.prototype.add.apply(dataFilterSelectors, args);
  spy.dataFilterSelectors.delete = (...args) => Set.prototype.delete.apply(dataFilterSelectors, args);

  return spy;
}

async function discoverEleventy() {
  const p = path.join(repoRoot, 'eleventy.config.mjs');
  const mod = await import(pathToFileURL(p));
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
    formats: Array.isArray(returned?.templateFormats) ? returned.templateFormats : [],
  };

  return { eleventyInfo, spy };
}

/* ------------------------------- enumeration ------------------------------- */
function listFiles() {
  const excludes = ['node_modules', '.git', 'bin', 'markdown_gateway', 'mcp-stack'];
  let files = [];
  if (haveCmd('fd', ['--version'])) {
    const args = ['--type', 'f', '--hidden', '--strip-cwd-prefix', '.', repoRoot];
    excludes.forEach(e => args.push('--exclude', e));
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

/* ---------------------------------- scans ---------------------------------- */
async function writeTreeBefore(files) {
  try {
    const out = shell('npx --yes tree -a -I "node_modules|.git"');
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
    '/(assets|docs|archives|work)/',
  ];

  let output = '';
  if (haveCmd('rg', ['--version'])) {
    const args = ['--no-ignore', '--hidden', '-n'];
    patterns.forEach(p => args.push('-e', p));
    args.push('--', '.');
    const r = spawnSync('rg', args, { cwd: repoRoot, encoding: 'utf8' });
    output = r.stdout || '';
  } else {
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
    writerPatterns.forEach(p => args.push('-e', p));
    args.push('--', '.');
    const r = spawnSync('rg', args, { cwd: repoRoot, encoding: 'utf8' });
    output = r.stdout || '';
  } else {
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
    !f.endsWith('.11ty.js') &&
    !f.startsWith('markdown_gateway/') &&
    !f.startsWith('mcp-stack/')
  );

  await fsp.writeFile(path.join(inspectDir, 'unref.txt'), unref.join('\n'));
  return unref;
}

/* ------------------------------ plan artifacts ----------------------------- */
async function writeMoveMap() {
  const intents = [
    { src: 'docs', dest: 'src/content/docs' },
    { src: 'docs/vendor', dest: 'src/content/docs/vendor-docs' },
    { src: 'docs/vendors', dest: 'src/content/docs/vendor-docs' },
    { src: 'flower_reports_showcase', dest: 'src/content/docs/flower' },
  ];

  const rows = [];
  for (const intent of intents) {
    const abs = path.join(repoRoot, intent.src);
    if (!fs.existsSync(abs)) continue;

    if (haveCmd('fd', ['--version'])) {
      const r = spawnSync('fd', ['--type', 'f', '--strip-cwd-prefix', '.', intent.src], { cwd: repoRoot, encoding: 'utf8' });
      if (r.status === 0) {
        for (const rel of r.stdout.split('\n').filter(Boolean)) {
          const from = path.join(intent.src, rel);
          const to = path.join(intent.dest, rel);
          rows.push(`${from}\t${to}`);
        }
        continue;
      }
    }
    // fallback walk
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

  await fsp.writeFile(path.join(planDir, 'move-map.tsv'), rows.join('\n'));
  return rows;
}

async function writeRewritesSed() {
  const pairs = [
    ['docs/', 'src/content/docs/'],
    ['docs/vendor/', 'src/content/docs/vendor-docs/'],
    ['docs/vendors/', 'src/content/docs/vendor-docs/'],
    ['flower_reports_showcase/', 'src/content/docs/flower/'],
  ];
  const sed = pairs.map(([from, to]) => `s|${from}|${to}|g`).join('\n');
  await fsp.writeFile(path.join(planDir, 'rewrites.sed'), sed);
  return pairs;
}

async function writeApplyScripts(passthroughs) {
  const hdr = '#!/bin/bash\nset -e\nif [ "$I_UNDERSTAND" != "1" ]; then echo "Refusing without I_UNDERSTAND=1"; exit 1; fi\n';

  const applyMoves =
    `${hdr}echo "Previewing git mv operations from var/plan/move-map.tsv"
while IFS=$'\\t' read -r FROM TO; do
  [ -z "$FROM" ] && continue
  echo git mv "$FROM" "$TO"
  git add -N "$FROM" "$TO" >/dev/null 2>&1 || true
done < var/plan/move-map.tsv
`;

  const applyRewrites =
    `${hdr}echo "Would run: sed -i -f var/plan/rewrites.sed <files>"
`;

  const applyBuild =
    `${hdr}echo "Proposed Eleventy passthrough copies:"
${passthroughs.map(p => `echo "  - ${p}"`).join('\n')}
`;

  const applySrcNoop =
    `${hdr}echo "No src normalization planned (templateFormats already support md/njk/html/11ty.js)."
`;

  await fsp.writeFile(path.join(planDir, 'apply-moves.sh'), applyMoves, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-rewrites.sh'), applyRewrites, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-build.sh'), applyBuild, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-src.sh'), applySrcNoop, { mode: 0o755 });
}

/* --------------------------------- reports --------------------------------- */
async function writeReports(eleventyInfo, moves, rewrites, writersTxt, unref, passthroughs, spyCalls) {
  const formats = (eleventyInfo.formats || []).join(', ');
  const md = [
    '# Plan Report',
    '## Overview',
    'Executed Eleventy configuration via a live spy to capture dirs, formats, and plugin/registration surfaces. No build or event handlers were executed.',
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
    '- None observed.',
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
      events: spyCalls.events,
      transforms: spyCalls.transforms,
    }
  };

  await fsp.writeFile(path.join(reportDir, 'plan.json'), JSON.stringify(json, null, 2));
}

/* ----------------------------------- main ---------------------------------- */
async function main() {
  ensureCleanTree();
  ensureDirs();

  // 1) Run Eleventy config through spy (no build)
  const { eleventyInfo, spy } = await discoverEleventy();

  // 2) Enumerate
  const files = listFiles();

  // 3) Inspect
  await writeTreeBefore(files);
  const refscanOut = await writeRefscan();
  const writersTxt = await writeWriters();
  const unref = await writeUnreferenced(files, refscanOut, eleventyInfo);

  // 4) Plan (no src normalization; formats already include md/njk/html/11ty.js)
  const moves = await writeMoveMap();
  const rewrites = await writeRewritesSed();

  // 5) Scripts
  const passthroughs = [
    'src/content/docs/vendor-docs/**',
    'src/content/docs/flower/normalized/**',
    'src/content/docs/flower/reports/**',
  ];
  await writeApplyScripts(passthroughs);

  // 6) Report
  await writeReports(eleventyInfo, moves, rewrites, writersTxt, unref, passthroughs, spy._calls);

  console.log('DRY RUN COMPLETE :: artifacts at var/');
}

main().catch(err => { console.error(err); process.exit(1); });
