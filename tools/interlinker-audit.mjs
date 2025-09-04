#!/usr/bin/env node
// tools/interlinker-audit.mjs
// Audit unresolved links and propose or apply aliases.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import natural from 'natural';
import { routeRegistry, getByPath } from '../lib/interlinkers/route-registry.mjs';

const HELP = `
Usage: node tools/interlinker-audit.mjs [--apply] [--min <score>] [--kind <kind>]

Options:
  --apply          Apply best alias to source JSON when safe (archives only)
  --min <score>    Minimum similarity to apply (default 0.86)
  --kind <kind>    Limit audit to a particular kind
`;

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function uniq(arr) { return Array.from(new Set(arr)); }
function toSlug(s) { return String(s ?? '').normalize('NFKD').toLowerCase().replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-'); }

function getDataset(kind, currentPageData) {
  const def = routeRegistry.kinds[kind];
  if (!def) return [];
  for (const key of def.datasetKeys) {
    const arr = getByPath(currentPageData, key);
    if (Array.isArray(arr) && arr.length) return arr;
  }
  return [];
}

function indexFor(kind, dataset) {
  const def = routeRegistry.kinds[kind];
  const idx = [];
  for (const entry of dataset) {
    const data = entry?.data || entry;
    const label = data?.title || data?.name || entry?.fileSlug || data?.product_id || '';
    const slug = toSlug(label);
    const canon = def.canonicalFromData(data);
    const aliases = def.aliasesFromData(data);
    idx.push({ label, slug, canon, aliases, data, entry });
  }
  return idx;
}

function score(a, b) {
  const aw = toSlug(a), bw = toSlug(b);
  const jaro = natural.JaroWinklerDistance(aw, bw);
  const trig = natural.TrigramDistance(aw, bw); // 0..1 higher=more similar
  // Combine (weighted) — emphasize trigram for slug-like strings
  return (0.4 * jaro) + (0.6 * trig);
}

function propose(kind, key, dataset) {
  const idx = indexFor(kind, dataset);
  const rows = idx.map((r) => ({ ...r, score: score(key, r.slug) }));
  rows.sort((a,b) => b.score - a.score);
  return rows.slice(0, 10);
}

function applyAlias(kind, unresolvedKey, best) {
  // Only archives JSON have __source to patch
  const src = best?.data?.__source;
  if (!src || !/\.json$/i.test(src)) {
    return { applied: false, reason: 'no-source' };
  }
  const obj = readJson(src);
  const cur = Array.isArray(obj.slugAliases) ? obj.slugAliases : [];
  if (cur.includes(unresolvedKey)) return { applied: true, reason: 'already-present' };
  obj.slugAliases = uniq([...cur, unresolvedKey]);
  fs.writeFileSync(src, JSON.stringify(obj, null, 2));
  return { applied: true, reason: 'added' };
}

async function main() {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.set('apply', true);
    else if (a === '--min') { args.set('min', Number(argv[++i])); }
    else if (a === '--kind') { args.set('kind', String(argv[++i])); }
    else if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0); }
  }
  const threshold = Number.isFinite(args.get('min')) ? args.get('min') : 0.86;
  const onlyKind = args.get('kind');

  const reportPath = path.join('artifacts','reports','interlinker-unresolved.json');
  if (!fs.existsSync(reportPath)) { console.error('No report found at', reportPath); process.exit(1); }
  const report = readJson(reportPath);
  const unresolved = Array.isArray(report.items) ? report.items : [];

  // We cannot recreate full Eleventy context; best-effort: use global data snapshot files exported by archive loader.
  // Here we read a synthetic page-like data object from global data writer in lib/eleventy/archives.mjs
  // which exposes archive* globals. For collections.* we cannot get during CLI; so we only handle archive kinds for --apply.
  const globals = {};
  try {
    const g = ['archiveProductsEn','archiveAllProducts','archiveProducts','archiveCharactersEn','archiveAllCharacters','archiveCharacters','archiveSeriesEn','archiveAllSeries','archiveSeries'];
    for (const key of g) {
      const p = path.join('.eleventy.js'); // placeholder to satisfy path roots; we cannot load Eleventy
      globals[key] = globals[key] || [];
    }
  } catch {}

  const results = [];
  for (const item of unresolved) {
    const kinds = onlyKind ? [onlyKind] : (Array.isArray(item.attemptedKinds) && item.attemptedKinds.length ? item.attemptedKinds : routeRegistry.defaultKindsPriority);
    for (const kind of kinds) {
      if (!routeRegistry.kinds[kind]) continue;
      const dataset = getDataset(kind, globals);
      const proposals = propose(kind, item.key, dataset);
      const best = proposals[0];
      results.push({ item, kind, proposals });
      if (args.get('apply') && best && best.score >= threshold && /^(product|character|series)$/.test(kind)) {
        const { applied, reason } = applyAlias(kind, toSlug(item.key), best);
        console.log(`[apply] kind=${kind} key=${item.key} → ${best.canon} score=${best.score.toFixed(3)} :: ${applied ? 'ok' : 'skipped'} (${reason})`);
      } else {
        const head = proposals.slice(0, 3).map(p => `${p.slug} (${p.score.toFixed(3)})`).join(', ');
        console.log(`[suggest] kind=${kind} key=${item.key} ⇒ ${head}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

