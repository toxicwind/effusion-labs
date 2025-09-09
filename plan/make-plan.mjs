#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

async function main() {
  // refuse if git status dirty
  const git = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (git.stdout.trim()) {
    console.error('Working tree dirty. Commit or stash changes before running.');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const varDir = path.join(repoRoot, 'var');
  const inspectDir = path.join(varDir, 'inspect');
  const planDir = path.join(varDir, 'plan');
  const reportDir = path.join(varDir, 'reports');
  fs.mkdirSync(inspectDir, { recursive: true });
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });

  // Eleventy discovery
  const eleventyConfigPath = path.join(repoRoot, 'eleventy.config.mjs');
  const eleventyModule = await import(pathToFileURL(eleventyConfigPath));
  const stub = {
    addPassthroughCopy() {},
    addGlobalData() {},
    addFilter() {},
    addNunjucksFilter() {},
    addPairedShortcode() {},
    addCollection() {},
    amendLibrary() {},
    on() {},
    markdownLibrary: { parse(){}, renderer:{ render(){ return ''; } }, options:{} }
  };
  const result = eleventyModule.default ? eleventyModule.default(stub) : eleventyModule;
  const eleventyInfo = {
    input: result.dir?.input || 'src',
    includes: result.dir?.includes || '_includes',
    data: result.dir?.data || '_data',
    formats: result.templateFormats || []
  };

  // file enumeration using fd or git ls-files
  let files = [];
  const fd = spawnSync('fd', ['--type', 'f', '--hidden', '--strip-cwd-prefix', '.', repoRoot, '--exclude', 'node_modules', '--exclude', '.git', '--exclude', 'bin', '--exclude', 'markdown_gateway', '--exclude', 'mcp-stack'], { encoding: 'utf8' });
  if (fd.status === 0) {
    files = fd.stdout.trim().split('\n').filter(Boolean);
  } else {
    const ls = spawnSync('git', ['ls-files'], { encoding: 'utf8' });
    files = ls.stdout.trim().split('\n').filter(Boolean).filter(f => !f.startsWith('node_modules/') && !f.startsWith('.git/') && !f.startsWith('bin/') && !f.startsWith('markdown_gateway/') && !f.startsWith('mcp-stack/'));
  }

  // tree.before.txt
  spawnSync('npx', ['tree', '-a', '-I', 'node_modules|.git', '-o', path.join(inspectDir, 'tree.before.txt')], { encoding:'utf8', stdio:'ignore' });

  // refscan.txt
  const refscanPatterns = [
    '\\bimport\\s+',
    '\\bfrom\\s+[\"\']',
    '\\brequire\\(',
    '\\{\\%\\s*(include|extends|from|render|macro)\\b',
    '^\\s*(layout|permalink)\\s*:',
    'href=',
    'src=',
    '<link\\s+rel=[\"\']stylesheet[\"\']',
    '<script[^>]*\\ssrc=',
    'url\\(',
    '/(assets|docs|archives|work)'
  ];
  const rgArgs = ['--no-ignore', '--hidden', '-n'];
  for (const p of refscanPatterns) rgArgs.push('-e', p);
  rgArgs.push('--');
  rgArgs.push('.');
  const rg = spawnSync('rg', rgArgs, { encoding: 'utf8' });
  await fsp.writeFile(path.join(inspectDir, 'refscan.txt'), rg.stdout);

  // writers.txt
  const writerPatterns = ['fs\\.(write|append|createWriteStream|mkdir)', '>>', '\\btee\\b', 'rimraf', 'rm -rf'];
  const wargs = ['--no-ignore', '--hidden', '-n'];
  for (const p of writerPatterns) wargs.push('-e', p);
  wargs.push('--');
  wargs.push('.');
  const wscan = spawnSync('rg', wargs, { encoding: 'utf8' });
  const writerLines = wscan.stdout.split('\n').filter(l => /(lib|artifacts|logs|tmp)\//.test(l));
  await fsp.writeFile(path.join(inspectDir, 'writers.txt'), writerLines.join('\n'));

  // unreferenced
  const refFiles = new Set(rg.stdout.split('\n').map(l => l.split(':')[0]).filter(Boolean));
  const unref = files.filter(f => !refFiles.has(f) && !f.startsWith(`${eleventyInfo.input}/${eleventyInfo.includes}`) && !f.startsWith(`${eleventyInfo.input}/${eleventyInfo.data}`) && !f.endsWith('.11ty.js') && !f.startsWith('markdown_gateway/') && !f.startsWith('mcp-stack/'));
  await fsp.writeFile(path.join(inspectDir, 'unref.txt'), unref.join('\n'));

  // move-map.tsv
  const moveMap = [];
  function mapDir(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) return;
    const res = spawnSync('fd', ['--type', 'f', '--strip-cwd-prefix', '.', srcDir], { encoding: 'utf8' });
    if (res.status !== 0) return;
    for (const line of res.stdout.split('\n').filter(Boolean)) {
      const from = path.join(srcDir, line);
      const to = path.join(destDir, line);
      moveMap.push(`${from}\t${to}`);
    }
  }
  mapDir('docs', 'src/content/docs');
  mapDir('docs/vendor', 'src/content/docs/vendor-docs');
  mapDir('docs/vendors', 'src/content/docs/vendor-docs');
  mapDir('flower_reports_showcase', 'src/content/docs/flower');
  await fsp.writeFile(path.join(planDir, 'move-map.tsv'), moveMap.join('\n'));

  // src-move-map.tsv (placeholder: detect CSS in assets except app.css)
  const srcMoves = [];
  if (fs.existsSync('src/assets/css')) {
    const cssFiles = await fsp.readdir('src/assets/css');
    for (const f of cssFiles) {
      if (f !== 'app.css' && f.endsWith('.css')) {
        srcMoves.push(`src/assets/css/${f}\tsrc/styles/${f}`);
      }
    }
  }
  await fsp.writeFile(path.join(planDir, 'src-move-map.tsv'), srcMoves.join('\n'));

  // rewrites.sed
  const rewrites = [
    's|docs/|src/content/docs/|g',
    's|docs/vendor/|src/content/docs/vendor-docs/|g',
    's|docs/vendors/|src/content/docs/vendor-docs/|g',
    's|flower_reports_showcase/|src/content/docs/flower/|g'
  ];
  await fsp.writeFile(path.join(planDir, 'rewrites.sed'), rewrites.join('\n'));

  // apply scripts
  const scripts = {
    'apply-moves.sh': '#!/bin/bash\nset -e\n[ "$I_UNDERSTAND" != "1" ] && echo "Refusing: set I_UNDERSTAND=1" && exit 1\necho "Previewing moves"\nwhile IFS="\t" read -r from to; do\n  [ -z "$from" ] && continue\n  echo "git mv \"$from\" \"$to\""\n  git add -N "$from" "$to"\ndone < var/plan/move-map.tsv\n',
    'apply-rewrites.sh': '#!/bin/bash\nset -e\n[ "$I_UNDERSTAND" != "1" ] && echo "Refusing: set I_UNDERSTAND=1" && exit 1\necho "Would run sed -f var/plan/rewrites.sed on sources"\n',
    'apply-build.sh': '#!/bin/bash\nset -e\n[ "$I_UNDERSTAND" != "1" ] && echo "Refusing: set I_UNDERSTAND=1" && exit 1\necho "Would configure passthrough copies"\n',
    'apply-src.sh': '#!/bin/bash\nset -e\n[ "$I_UNDERSTAND" != "1" ] && echo "Refusing: set I_UNDERSTAND=1" && exit 1\necho "Previewing src normalization"\nwhile IFS="\t" read -r from to; do\n  [ -z "$from" ] && continue\n  echo "git mv \"$from\" \"$to\""\n  git add -N "$from" "$to"\ndone < var/plan/src-move-map.tsv\n'
  };
  for (const [name, content] of Object.entries(scripts)) {
    const p = path.join(planDir, name);
    await fsp.writeFile(p, content);
    await fsp.chmod(p, 0o755);
  }

  // reports
  const planMarkdown = [
    '# Plan Report',
    '## Overview',
    'Dry-run planning of documentation relocation and src normalization.',
    '## Eleventy Discovery',
    `input: ${eleventyInfo.input}`,
    `includes: ${eleventyInfo.includes}`,
    `data: ${eleventyInfo.data}`,
    `formats: ${eleventyInfo.formats.join(', ')}`,
    '## Proposed Moves',
    moveMap.length ? moveMap.map(m => '- ' + m).join('\n') : 'None',
    '## Proposed Rewrites',
    rewrites.map(r => '- ' + r).join('\n'),
    '## Proposed Passthroughs',
    '- src/content/docs/vendor-docs/**',
    '- src/content/docs/flower/normalized/**',
    '- src/content/docs/flower/reports/**',
    '## Writers of lib|artifacts|logs|tmp',
    writerLines.map(l => '- ' + l).join('\n'),
    '## Unreferenced — Conjecture',
    unref.map(f => `- ${f} — needs review`).join('\n'),
    '## Edge Cases (as needed, evidence-driven)',
    'None observed.'
  ].join('\n');
  await fsp.writeFile(path.join(reportDir, 'plan.md'), planMarkdown);

  const planJson = {
    eleventy: eleventyInfo,
    moves: moveMap.map(m => {
      const [from, to] = m.split('\t');
      return { from, to };
    }),
    rewrites,
    writers: writerLines,
    unreferenced: unref,
    edgeCases: [],
    passthroughs: [
      'src/content/docs/vendor-docs/**',
      'src/content/docs/flower/normalized/**',
      'src/content/docs/flower/reports/**'
    ]
  };
  await fsp.writeFile(path.join(reportDir, 'plan.json'), JSON.stringify(planJson, null, 2));

  console.log('DRY RUN COMPLETE :: artifacts at var/');
}

import { pathToFileURL } from 'node:url';
main().catch(err => { console.error(err); process.exit(1); });
