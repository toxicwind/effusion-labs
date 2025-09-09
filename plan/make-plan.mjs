#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * A mock of the Eleventy configuration object that spies on the methods
 * called by a user's configuration file to capture the settings.
 */
class EleventyConfigSpy {
  constructor() {
    this.passthroughCopies = [];
    this.globalData = {};
    this.filters = {};
    this.nunjucksFilters = {};
    this.pairedShortcodes = {};
    this.collections = {};
    this.libraryAmendments = [];
    this.eventHandlers = {};
    this.markdownLibrary = {
      parse() { },
      renderer: { render() { return ''; } },
      options: {}
    };
  }

  addPassthroughCopy(target) {
    this.passthroughCopies.push(target);
    return this;
  }

  addGlobalData(key, data) {
    this.globalData[key] = data;
    return this;
  }

  addFilter(name, callback) {
    this.filters[name] = callback;
    return this;
  }

  addNunjucksFilter(name, callback) {
    this.nunjucksFilters[name] = callback;
    return this;
  }

  addPairedShortcode(name, callback) {
    this.pairedShortcodes[name] = callback;
    return this;
  }

  addCollection(name, callback) {
    this.collections[name] = callback;
    return this;
  }

  amendLibrary(name, callback) {
    this.libraryAmendments.push({ name, callback });
    return this;
  }

  on(eventName, callback) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(callback);
    return this;
  }
}

async function main() {
  // 1. Pre-flight checks
  const git = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (git.stdout.trim()) {
    console.error('Working tree dirty. Commit or stash changes before running.');
    process.exit(1);
  }

  // 2. Setup directories
  const repoRoot = process.cwd();
  const varDir = path.join(repoRoot, 'var');
  const inspectDir = path.join(varDir, 'inspect');
  const planDir = path.join(varDir, 'plan');
  const reportDir = path.join(varDir, 'reports');
  fs.mkdirSync(inspectDir, { recursive: true });
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });

  // 3. Eleventy discovery using the real config file
  const eleventyConfigPath = path.join(repoRoot, 'eleventy.config.mjs');
  let eleventyInfo = { passthroughCopies: [], input: 'src', includes: '_includes', data: '_data', formats: [] };

  if (fs.existsSync(eleventyConfigPath)) {
    try {
      const eleventyModule = await import(pathToFileURL(eleventyConfigPath));
      const eleventyConfig = new EleventyConfigSpy();
      const result = eleventyModule.default ? eleventyModule.default(eleventyConfig) : eleventyModule;

      eleventyInfo = {
        input: result?.dir?.input || 'src',
        includes: result?.dir?.includes || '_includes',
        data: result?.dir?.data || '_data',
        formats: result?.templateFormats || [],
        passthroughCopies: eleventyConfig.passthroughCopies
      };
      console.log('Successfully loaded and parsed eleventy.config.mjs.');
    } catch (e) {
      console.error('Could not load or parse eleventy.config.mjs:', e);
    }
  } else {
    console.log('eleventy.config.mjs not found, using default settings.');
  }


  // 4. File enumeration using fd or git ls-files
  let files = [];
  const fd = spawnSync('fd', ['--type', 'f', '--hidden', '--strip-cwd-prefix', '.', repoRoot, '--exclude', 'node_modules', '--exclude', '.git', '--exclude', 'bin', '--exclude', 'markdown_gateway', '--exclude', 'mcp-stack'], { encoding: 'utf8' });
  if (fd.status === 0) {
    files = fd.stdout.trim().split('\n').filter(Boolean);
  } else {
    console.log('`fd` not found, falling back to `git ls-files`.');
    const ls = spawnSync('git', ['ls-files'], { encoding: 'utf8' });
    files = ls.stdout.trim().split('\n').filter(Boolean).filter(f => !f.startsWith('node_modules/') && !f.startsWith('.git/') && !f.startsWith('bin/') && !f.startsWith('markdown_gateway/') && !f.startsWith('mcp-stack/'));
  }

  // 5. Inspection phase
  console.log('Running inspection tools (tree, rg)...');
  spawnSync('npx', ['tree', '-a', '-I', 'node_modules|.git', '-o', path.join(inspectDir, 'tree.before.txt')], { encoding: 'utf8', stdio: 'ignore' });

  // refscan.txt: Find all file references
  const refscanPatterns = ['\\bimport\\s+', '\\bfrom\\s+[\"\']', '\\brequire\\(', '\\{\\%\\s*(include|extends|from|render|macro)\\b', '^\\s*(layout|permalink)\\s*:', 'href=', 'src=', '<link\\s+rel=[\"\']stylesheet[\"\']', '<script[^>]*\\ssrc=', 'url\\(', '/(assets|docs|archives|work)'];
  const rgArgs = ['--no-ignore', '--hidden', '-n', ...refscanPatterns.flatMap(p => ['-e', p]), '--', '.'];
  const rg = spawnSync('rg', rgArgs, { encoding: 'utf8' });
  await fsp.writeFile(path.join(inspectDir, 'refscan.txt'), rg.stdout);

  // writers.txt: Find scripts that write to disk
  const writerPatterns = ['fs\\.(write|append|createWriteStream|mkdir)', '>>', '\\btee\\b', 'rimraf', 'rm -rf'];
  const wargs = ['--no-ignore', '--hidden', '-n', ...writerPatterns.flatMap(p => ['-e', p]), '--', '.'];
  const wscan = spawnSync('rg', wargs, { encoding: 'utf8' });
  const writerLines = wscan.stdout.split('\n').filter(l => /(lib|artifacts|logs|tmp)\//.test(l));
  await fsp.writeFile(path.join(inspectDir, 'writers.txt'), writerLines.join('\n'));

  // unref.txt: Find potentially unreferenced files
  const refFiles = new Set(rg.stdout.split('\n').map(l => l.split(':')[0]).filter(Boolean));
  const unref = files.filter(f => !refFiles.has(f) && !f.startsWith(`${eleventyInfo.input}/${eleventyInfo.includes}`) && !f.startsWith(`${eleventyInfo.input}/${eleventyInfo.data}`) && !f.endsWith('.11ty.js') && !f.startsWith('markdown_gateway/') && !f.startsWith('mcp-stack/'));
  await fsp.writeFile(path.join(inspectDir, 'unref.txt'), unref.join('\n'));

  // 6. Planning phase
  console.log('Generating migration plan...');
  const moveMap = [];
  function mapDir(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) return;
    const res = spawnSync('fd', ['--type', 'f', '--strip-cwd-prefix', '.', srcDir], { encoding: 'utf8' });
    if (res.status !== 0) return;
    for (const line of res.stdout.split('\n').filter(Boolean)) {
      // The `line` from fd already includes the base directory, so we just use it directly.
      moveMap.push(`${line}\t${path.join(destDir, path.relative(srcDir, line))}`);
    }
  }

  mapDir('docs', 'src/content/docs');
  mapDir('docs/vendor', 'src/content/docs/vendor-docs');
  mapDir('docs/vendors', 'src/content/docs/vendor-docs');
  mapDir('flower_reports_showcase', 'src/content/docs/flower');
  await fsp.writeFile(path.join(planDir, 'move-map.tsv'), moveMap.join('\n'));

  // src-move-map.tsv (placeholder: detect CSS in assets except app.css)
  const srcMoves = [];
  const cssDir = 'src/assets/css';
  if (fs.existsSync(cssDir)) {
    const cssFiles = await fsp.readdir(cssDir);
    for (const f of cssFiles) {
      if (f !== 'app.css' && f.endsWith('.css')) {
        srcMoves.push(`src/assets/css/${f}\tsrc/styles/${f}`);
      }
    }
  }
  await fsp.writeFile(path.join(planDir, 'src-move-map.tsv'), srcMoves.join('\n'));

  // rewrites.sed
  const rewrites = [
    's|docs/vendor/|src/content/docs/vendor-docs/|g',
    's|docs/vendors/|src/content/docs/vendor-docs/|g',
    's|flower_reports_showcase/|src/content/docs/flower/|g',
    's|docs/|src/content/docs/|g', // Place this last to avoid over-matching
  ];
  await fsp.writeFile(path.join(planDir, 'rewrites.sed'), rewrites.join('\n'));

  // apply scripts
  const scripts = {
    'apply-moves.sh': '#!/bin/bash\nset -e\n[ "$I_UNDERSTAND" != "1" ] && echo "Refusing: set I_UNDERSTAND=1" && exit 1\necho "Applying moves..."\nwhile IFS=$"\\t" read -r from to; do\n  [ -z "$from" ] && continue\n  echo "git mv \\"$from\\" \\"$to\\""\n  mkdir -p "$(dirname "$to")"\n  git mv "$from" "$to"\ndone < var/plan/move-map.tsv\n',
    'apply-rewrites.sh': '#!/bin/bash\nset -e\n[ "$I_UNDERSTAND" != "1" ] && echo "Refusing: set I_UNDERSTAND=1" && exit 1\nfiles_to_rewrite=$(git ls-files)\necho "Running sed -i -f var/plan/rewrites.sed on git-tracked files..."\nsed -i -f var/plan/rewrites.sed $files_to_rewrite\n',
    'apply-build.sh': '#!/bin/bash\nset -e\n[ "$I_UNDERSTAND" != "1" ] && echo "Refusing: set I_UNDERSTAND=1" && exit 1\necho "MANUAL STEP: Add proposed passthrough copies to eleventy.config.mjs"\n',
    'apply-src.sh': '#!/bin/bash\nset -e\n[ "$I_UNDERSTAND" != "1" ] && echo "Refusing: set I_UNDERSTAND=1" && exit 1\necho "Applying src normalization..."\nwhile IFS=$"\\t" read -r from to; do\n  [ -z "$from" ] && continue\n  echo "git mv \\"$from\\" \\"$to\\""\n  mkdir -p "$(dirname "$to")"\n  git mv "$from" "$to"\ndone < var/plan/src-move-map.tsv\n'
  };
  for (const [name, content] of Object.entries(scripts)) {
    const p = path.join(planDir, name);
    await fsp.writeFile(p, content);
    await fsp.chmod(p, 0o755);
  }

  // 7. Reporting
  console.log('Generating reports...');
  const proposedPassthroughs = [
    'src/content/docs/vendor-docs/**',
    'src/content/docs/flower/normalized/**',
    'src/content/docs/flower/reports/**',
  ];

  const planMarkdown = [
    '# Plan Report',
    '## Overview',
    'Dry-run planning of documentation relocation and src normalization.',
    '## Eleventy Discovery',
    `**Input Dir**: \`${eleventyInfo.input}\``,
    `**Includes Dir**: \`${eleventyInfo.includes}\``,
    `**Data Dir**: \`${eleventyInfo.data}\``,
    `**Template Formats**: \`${eleventyInfo.formats.join(', ')}\``,
    '### Discovered Passthrough Copies',
    eleventyInfo.passthroughCopies.length ? eleventyInfo.passthroughCopies.map(p => `- \`${typeof p === 'object' ? JSON.stringify(p) : p}\``).join('\n') : 'None found.',
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

main().catch(err => { console.error(err); process.exit(1); });
