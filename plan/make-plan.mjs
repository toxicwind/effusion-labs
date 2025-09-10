#!/usr/bin/env node
/**
 * make-plan.mjs — DRY-RUN PROJECT PLANNER (no Eleventy imports)
 * -----------------------------------------------------------------------------
 * What it does:
 *  • Filesystem-only discovery (no config imports).
 *  • Enumerates repository, writes inspection artifacts (tree/refscan/writers/unref).
 *  • Proposes doc moves (docs → src/content/docs/*).
 *  • **Src normalization (CSS)**:
 *      - Canonical CSS dir: src/styles
 *      - Plan moves from src/assets/css/** → src/styles/
 *      - Ignore app.css and dotfiles in assets/css
 *      - Duplicates:
 *          * identical content → report as redundant duplicate (no move)
 *          * different content → park at src/styles/_conflicts/from-assets/<name>
 *      - Generate sed rewrite rules for clean moves
 *  • Emits preview-only shell scripts.
 *
 * Artifacts:
 *   var/inspect/tree.before.txt
 *   var/inspect/refscan.txt
 *   var/inspect/writers.txt
 *   var/inspect/unref.txt
 *   var/plan/move-map.tsv
 *   var/plan/src-move-map.tsv
 *   var/plan/rewrites.sed
 *   var/plan/apply-moves.sh
 *   var/plan/apply-src.sh
 *   var/plan/apply-rewrites.sh
 *   var/plan/apply-build.sh
 *   var/reports/plan.md
 *   var/reports/plan.json
 *
 * Safety:
 *  - Refuses to run if working tree is dirty.
 *  - No destructive operations; apply scripts only preview by default.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/* -------------------------------- constants -------------------------------- */
const repoRoot = process.cwd();
const varDir = path.join(repoRoot, 'var');
const inspectDir = path.join(varDir, 'inspect');
const planDir = path.join(varDir, 'plan');
const reportDir = path.join(varDir, 'reports');

const TEMPLATE_FORMATS = ['md', 'njk', 'html', '11ty.js'];

/* --------------------------------- helpers --------------------------------- */
function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe', shell: true, ...opts });
  } catch (err) {
    if (err && err.stdout) return String(err.stdout);
    return '';
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
  const status = sh('git status --porcelain').trim();
  if (status) {
    console.error('Working tree dirty. Commit or stash changes before running.');
    process.exit(1);
  }
}
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
    const out = sh('git ls-files');
    files = out.split('\n').filter(Boolean)
      .filter(f => !excludes.some(e => f.startsWith(`${e}/`)));
  }
  return files;
}
function hashFile(absPath) {
  const h = createHash('sha256');
  h.update(fs.readFileSync(absPath));
  return h.digest('hex');
}
function escapeSedLiteral(s) {
  // Use | as delimiter; escape backslashes and pipes
  return String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/* --------------------------- filesystem “discovery” ------------------------- */
function discoverByFS() {
  const input = fs.existsSync(path.join(repoRoot, 'src')) ? 'src' : '.';

  function pickIncludes() {
    const cands = [path.join(input, '_includes'), '_includes', path.join(input, 'includes')];
    for (const c of cands) if (fs.existsSync(path.join(repoRoot, c))) return c;
    return path.join(input, '_includes');
  }
  function pickData() {
    const cands = [path.join(input, '_data'), '_data', path.join(input, 'data')];
    for (const c of cands) if (fs.existsSync(path.join(repoRoot, c))) return c;
    return path.join(input, '_data');
  }
  const includes = pickIncludes();
  const data = pickData();
  return { input, includes, data, formats: TEMPLATE_FORMATS.slice(), output: '_site' };
}

/* ---------------------------------- scans ---------------------------------- */
async function writeTreeBefore(files) {
  try {
    const out = sh('npx --yes tree -a -I "node_modules|.git"');
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

async function writeUnreferenced(allFiles, refscanOutput, eleventy) {
  const refFiles = new Set(
    (refscanOutput || '')
      .split('\n')
      .map(l => l.split(':')[0])
      .filter(Boolean)
  );
  const unref = allFiles.filter(f =>
    !refFiles.has(f) &&
    !f.startsWith(eleventy.includes) &&
    !f.startsWith(eleventy.data) &&
    !f.endsWith('.11ty.js') &&
    !f.startsWith('markdown_gateway/') &&
    !f.startsWith('mcp-stack/')
  );
  await fsp.writeFile(path.join(inspectDir, 'unref.txt'), unref.join('\n'));
  return unref;
}

/* ------------------------------- docs moves -------------------------------- */
async function writeMoveMapDocs() {
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
          rows.push(`${path.join(intent.src, rel)}\t${path.join(intent.dest, rel)}`);
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
        else if (stat.isFile()) rows.push(`${full}\t${path.join(intent.dest, relBase, e)}`);
      }
    };
    walk(intent.src);
  }
  await fsp.writeFile(path.join(planDir, 'move-map.tsv'), rows.join('\n'));
  return rows;
}

/* -------------------------- src normalization (CSS) ------------------------- */
async function planSrcNormalization() {
  const moves = [];                 // TSV "from\tto" to write to src-move-map.tsv
  const rewrites = [];              // [["old","new"], ...] for sed
  const conflicts = {               // report-only details
    redundantDuplicates: [],        // identical content in both places
    contentConflicts: [],           // different content; parked under _conflicts
    skipped: [],                    // app.css, dotfiles, non-css
  };

  const assetsCssDir = path.join(repoRoot, 'src', 'assets', 'css');
  const stylesDir = path.join(repoRoot, 'src', 'styles');
  if (!fs.existsSync(assetsCssDir)) {
    await fsp.writeFile(path.join(planDir, 'src-move-map.tsv'), '');
    return { moves, rewrites, conflicts };
  }

  // Collect candidate files in assets/css
  const entries = await fsp.readdir(assetsCssDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;

    // skip dotfiles and app.css
    if (name.startsWith('.')) { conflicts.skipped.push(path.join('src/assets/css', name)); continue; }
    if (name === 'app.css') { conflicts.skipped.push(path.join('src/assets/css', name)); continue; }
    if (!name.endsWith('.css')) { conflicts.skipped.push(path.join('src/assets/css', name)); continue; }

    const fromRel = path.join('src', 'assets', 'css', name);
    const toRel = path.join('src', 'styles', name);
    const fromAbs = path.join(repoRoot, fromRel);
    const toAbs = path.join(repoRoot, toRel);

    if (!fs.existsSync(stylesDir)) {
      // nothing there yet — plan clean move
      moves.push(`${fromRel}\t${toRel}`);
      // sed rewrites for both /assets/css and assets/css
      rewrites.push([`/assets/css/${name}`, `/styles/${name}`]);
      rewrites.push([`assets/css/${name}`, `styles/${name}`]);
      continue;
    }

    if (!fs.existsSync(toAbs)) {
      // clean move, no conflict
      moves.push(`${fromRel}\t${toRel}`);
      rewrites.push([`/assets/css/${name}`, `/styles/${name}`]);
      rewrites.push([`assets/css/${name}`, `styles/${name}`]);
      continue;
    }

    // Destination exists — compare content
    try {
      const hFrom = hashFile(fromAbs);
      const hTo = hashFile(toAbs);
      if (hFrom === hTo) {
        conflicts.redundantDuplicates.push({
          name, keep: toRel, redundant: fromRel
        });
        // No move and no rewrite needed—the reference likely already points at styles/ or both exist.
        continue;
      } else {
        // Different content → park the assets copy under _conflicts
        const parkedRel = path.join('src', 'styles', '_conflicts', 'from-assets', name);
        moves.push(`${fromRel}\t${parkedRel}`);
        conflicts.contentConflicts.push({
          name, existing: toRel, parked: parkedRel, from: fromRel
        });
        // Do NOT emit rewrites (manual resolution required).
      }
    } catch {
      conflicts.skipped.push(fromRel);
    }
  }

  await fsp.writeFile(path.join(planDir, 'src-move-map.tsv'), moves.join('\n'));

  return { moves, rewrites, conflicts };
}

/* ------------------------------- rewrite rules ------------------------------ */
async function writeRewritesSed(docPairs, cssPairs) {
  const pairs = [
    // docs relocation
    ['docs/', 'src/content/docs/'],
    ['docs/vendor/', 'src/content/docs/vendor-docs/'],
    ['docs/vendors/', 'src/content/docs/vendor-docs/'],
    ['flower_reports_showcase/', 'src/content/docs/flower/'],
    // css path changes (clean moves only)
    ...cssPairs,
  ];

  // Build a sed file with safe literals
  const lines = pairs.map(([from, to]) =>
    `s|${escapeSedLiteral(from)}|${escapeSedLiteral(to)}|g`
  );

  await fsp.writeFile(path.join(planDir, 'rewrites.sed'), lines.join('\n'));
  return pairs;
}

/* ------------------------------- apply scripts ------------------------------ */
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

  const applySrc =
    `${hdr}echo "Previewing src normalization moves from var/plan/src-move-map.tsv"
while IFS=$'\\t' read -r FROM TO; do
  [ -z "$FROM" ] && continue
  echo git mv "$FROM" "$TO"
  git add -N "$FROM" "$TO" >/dev/null 2>&1 || true
done < var/plan/src-move-map.tsv
`;

  const applyRewrites =
    `${hdr}echo "Would run: sed -i -f var/plan/rewrites.sed <files>"
`;

  const applyBuild =
    `${hdr}echo "Suggested Eleventy passthroughs (verify in your project config):"
${passthroughs.map(p => `echo "  - ${p}"`).join('\n')}
`;

  await fsp.writeFile(path.join(planDir, 'apply-moves.sh'), applyMoves, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-src.sh'), applySrc, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-rewrites.sh'), applyRewrites, { mode: 0o755 });
  await fsp.writeFile(path.join(planDir, 'apply-build.sh'), applyBuild, { mode: 0o755 });
}

/* --------------------------------- reports --------------------------------- */
async function writeReports(eleventyInfo, movesDocs, srcPlan, rewrites, writersTxt, unref, passthroughs) {
  const formats = (eleventyInfo.formats || []).join(', ');
  const md = [
    '# Plan Report',
    '## Overview',
    'Filesystem-only discovery; no Eleventy or project imports used. Built a dry-run relocation/rewrites plan, **including src normalization for CSS** (assets/css → styles).',
    '## Eleventy Discovery (heuristic)',
    `- input: \`${eleventyInfo.input}\``,
    `- includes: \`${eleventyInfo.includes}\``,
    `- data: \`${eleventyInfo.data}\``,
    `- templateFormats: \`${formats}\``,
    '## Proposed Moves (docs & flower)',
    movesDocs.length ? movesDocs.map(m => `- ${m.replace('\t', ' -> ')}`).join('\n') : '- None',
    '## Src Normalization Moves (CSS)',
    srcPlan.moves.length ? srcPlan.moves.map(m => `- ${m.replace('\t', ' -> ')}`).join('\n') : '- None',
    '## Suggested Rewrites',
    rewrites.length ? rewrites.map(([f, t]) => `- \`${f}\` → \`${t}\``).join('\n') : '- None',
    '## Proposed Passthroughs',
    passthroughs.length ? passthroughs.map(p => `- ${p}`).join('\n') : '- None',
    '## Writers of lib|artifacts|logs|tmp',
    writersTxt.trim() ? writersTxt.split('\n').map(l => `- ${l}`).join('\n') : '- None observed.',
    '## Unreferenced — Conjecture',
    unref.length ? unref.map(f => `- ${f} — needs review`).join('\n') : '- None',
    '## srcConflicts',
    srcPlan.conflicts.redundantDuplicates.length
      ? ['### Redundant duplicates (identical content)', ...srcPlan.conflicts.redundantDuplicates.map(d => `- keep: \`${d.keep}\` — redundant: \`${d.redundant}\``)].join('\n')
      : '### Redundant duplicates (identical content)\n- None',
    srcPlan.conflicts.contentConflicts.length
      ? ['### Content conflicts (different content parked under _conflicts)', ...srcPlan.conflicts.contentConflicts.map(c => `- name: \`${c.name}\`\n  - existing: \`${c.existing}\`\n  - parked: \`${c.parked}\`\n  - from: \`${c.from}\``)].join('\n')
      : '### Content conflicts (different content)\n- None',
    srcPlan.conflicts.skipped.length
      ? ['### Skipped (not moved)', ...srcPlan.conflicts.skipped.map(s => `- ${s}`)].join('\n')
      : '### Skipped\n- None',
    '## Edge Cases',
    '- None observed.',
  ].join('\n');

  await fsp.writeFile(path.join(reportDir, 'plan.md'), md);

  const json = {
    eleventy: eleventyInfo,
    moves: {
      docs: movesDocs.map(row => {
        const [from, to] = row.split('\t');
        return { from, to };
      }),
      src: srcPlan.moves.map(row => {
        const [from, to] = row.split('\t');
        return { from, to };
      }),
    },
    rewrites: rewrites.map(([from, to]) => ({ from, to })),
    writers: writersTxt.split('\n').filter(Boolean),
    unreferenced: unref,
    edgeCases: [],
    passthroughs,
    srcConflicts: srcPlan.conflicts,
  };

  await fsp.writeFile(path.join(reportDir, 'plan.json'), JSON.stringify(json, null, 2));
}

/* ----------------------------------- main ---------------------------------- */
async function main() {
  ensureCleanTree();
  ensureDirs();

  // 1) Heuristic discovery
  const eleventyInfo = discoverByFS();

  // 2) Enumerate
  const files = listFiles();

  // 3) Inspect
  await writeTreeBefore(files);
  const refscanOut = await writeRefscan();
  const writersTxt = await writeWriters();
  const unref = await writeUnreferenced(files, refscanOut, eleventyInfo);

  // 4) Plan (docs)
  const movesDocs = await writeMoveMapDocs();

  // 5) Plan (src normalization: CSS)
  const srcPlan = await planSrcNormalization();

  // 6) Rewrites (docs + css-clean-moves only)
  const rewrites = await writeRewritesSed(
    [
      ['docs/', 'src/content/docs/'],
      ['docs/vendor/', 'src/content/docs/vendor-docs/'],
      ['docs/vendors/', 'src/content/docs/vendor-docs/'],
      ['flower_reports_showcase/', 'src/content/docs/flower/'],
    ],
    srcPlan.rewrites
  );

  // 7) Scripts
  const passthroughs = [
    // existing content suggestions
    'src/content/docs/vendor-docs/**',
    'src/content/docs/flower/normalized/**',
    'src/content/docs/flower/reports/**',
    // **src normalization safety**: ensure static copies
    'src/styles/**',
    'src/assets/js/**',
    'src/assets/**',
  ];
  await writeApplyScripts(passthroughs);

  // 8) Report
  await writeReports(eleventyInfo, movesDocs, srcPlan, rewrites, writersTxt, unref, passthroughs);

  console.log('DRY RUN COMPLETE :: artifacts at var/');
}

main().catch(err => { console.error(err); process.exit(1); });
