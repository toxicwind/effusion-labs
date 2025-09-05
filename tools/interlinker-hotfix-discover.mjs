#!/usr/bin/env node
// tools/interlinker-hotfix-discover.mjs
// Emit artifacts/reports/interlinker-hotfix-discovery.json with:
// - plugin version and key file paths
// - occurrences of .match(...) and new JSDOM(...)
// - Dockerfile stages and where patch-package runs / patches are available
// - package.json overrides relevant to glob/uuid/rimraf

import fs from 'node:fs';
import path from 'node:path';

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function json(p) { try { return JSON.parse(read(p) || 'null'); } catch { return null; } }

function scanOccurrences(file, patterns) {
  const out = [];
  const src = read(file);
  if (!src) return out;
  const lines = src.split(/\r?\n/);
  patterns.forEach(({ name, re }) => {
    lines.forEach((line, idx) => {
      if (re.test(line)) {
        out.push({ file, line: idx + 1, kind: name, excerpt: line.trim().slice(0, 200) });
      }
    });
  });
  return out;
}

const pkg = json('package.json') || {};
const pluginDir = path.join('node_modules', '@photogabble', 'eleventy-plugin-interlinker');
const pluginPkg = json(path.join(pluginDir, 'package.json')) || {};

const esmFiles = ['src/wikilink-parser.js','src/html-link-parser.js','src/interlinker.js','src/markdown-ext.js','src/resolvers.js','src/util.js']
  .map(p => path.join(pluginDir, p));
const cjsFile = path.join(pluginDir, 'index.cjs');

const patterns = [
  { name: 'match-call', re: /\.match\s*\(/ },
  { name: 'new-JSDOM', re: /new\s+JSDOM\s*\(/ },
];

const scan = [];
for (const f of [cjsFile, ...esmFiles]) scan.push(...scanOccurrences(f, patterns));

// Dockerfile analysis
const dockerfile = '.portainer/Dockerfile';
const dockerSrc = read(dockerfile) || '';
const stages = [];
let currentStage = null;
dockerSrc.split(/\r?\n/).forEach((line, i) => {
  const from = line.match(/^FROM\s+([^\s]+)(?:\s+AS\s+([A-Za-z0-9_-]+))?/);
  if (from) {
    if (currentStage) stages.push(currentStage);
    currentStage = { name: from[2] || `stage@${i+1}`, from: from[1], lines: [], patchPackageRun: false, hasPatchesBeforeInstall: false };
  }
  if (currentStage) {
    currentStage.lines.push({ line: i + 1, text: line });
    if (/patch-package/.test(line)) currentStage.patchPackageRun = true;
    if (/COPY\s+patches\//.test(line) && /npm\s+ci/.test(dockerSrc.slice(0, (i+1)*2_048))) {
      currentStage.hasPatchesBeforeInstall = true;
    }
  }
});
if (currentStage) stages.push(currentStage);

const overrides = (pkg.overrides || {});

const out = {
  generatedAt: new Date().toISOString(),
  plugin: {
    name: '@photogabble/eleventy-plugin-interlinker',
    version: pluginPkg.version || pkg.devDependencies?.['@photogabble/eleventy-plugin-interlinker'] || null,
    baseDir: path.resolve(pluginDir),
    cjs: cjsFile,
    esm: esmFiles,
  },
  occurrences: scan,
  docker: {
    file: dockerfile,
    stages: stages.map(s => ({ name: s.name, from: s.from, patchPackageRun: s.patchPackageRun, hasPatchesBeforeInstall: s.hasPatchesBeforeInstall }))
  },
  overrides: Object.fromEntries(Object.entries(overrides).filter(([k]) => ['glob','uuid','rimraf'].includes(k)))
};

fs.mkdirSync(path.join('artifacts', 'reports'), { recursive: true });
const outPath = path.join('artifacts', 'reports', 'interlinker-hotfix-discovery.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);

