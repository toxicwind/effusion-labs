#!/usr/bin/env node
// Advisory linter: find likely archive-entity mentions that lack namespaces in wikilinks
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const archivesBase = path.join('src', 'content', 'archives');
const scanBase = 'src';
const outDir = path.join('artifacts', 'reports');
const outFile = path.join(outDir, 'archive-namespace-advisory.json');

const toPosix = (p) => p.replaceAll('\\','/');
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });

const slug = (s) => String(s ?? '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^\w\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

function walk(dir, filter = () => true) {
  const out = [];
  if (!exists(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p, filter));
    else if (ent.isFile() && filter(p)) out.push(p);
  }
  return out;
}

function loadArchiveSlugs() {
  const jsonFiles = walk(archivesBase, (p) => p.endsWith('.json'));
  const names = new Set();
  for (const f of jsonFiles) {
    try {
      const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
      const candidates = [raw.slug, raw.name, raw.title, raw.product_id, raw.product_title, raw.series];
      for (const c of candidates) { if (c) names.add(slug(c)); }
    } catch {}
  }
  return names;
}

function scanMarkdown(names) {
  const mdFiles = walk(scanBase, (p) => p.endsWith('.md') && !toPosix(p).includes('/content/archives/'));
  const findings = [];
  for (const f of mdFiles) {
    const src = fs.readFileSync(f, 'utf8');
    // find wikilinks [[...]], then flag ones that lack namespace
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(src))) {
      const inner = m[1].split('|')[0];
      if (inner.includes(':')) continue; // already namespaced
      const s = slug(inner);
      if (s && names.has(s)) {
        findings.push({ file: toPosix(f), match: inner, suggestion: `[[series:${inner}]] | [[character:${inner}]] | [[product:${inner}]]` });
      }
    }
  }
  return findings;
}

function main() {
  const names = loadArchiveSlugs();
  const findings = scanMarkdown(names);
  ensureDir(outDir);
  const payload = { generatedAt: new Date().toISOString(), count: findings.length, findings };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log(`Advisory archive namespace lint written to ${outFile} (${findings.length} findings)`);
}

main();
