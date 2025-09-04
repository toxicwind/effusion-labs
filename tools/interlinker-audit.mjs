#!/usr/bin/env node
// tools/interlinker-audit.mjs
// Audit unresolved links and propose or apply aliases.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import natural from 'natural';
import { routeRegistry } from '../lib/interlinkers/route-registry.mjs';

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

function collectJsonFiles(dirParts) {
  const base = path.join(...dirParts);
  if (!fs.existsSync(base)) return [];
  const out = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && /\.json$/i.test(p)) out.push(p);
    }
  };
  walk(base);
  return out;
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function datasetFor(kind) {
  const out = [];
  if (kind === 'product') {
    const files = collectJsonFiles(['src','content','archives']).filter(p => /\/products\//.test(p));
    for (const p of files) {
      const d = readJson(p); d.__source = p;
      const slug = d.slugCanonical || d.productSlug || d.slug;
      out.push({ data: d, href: `/archives/product/${slug}/` });
    }
  } else if (kind === 'character') {
    const files = collectJsonFiles(['src','content','archives']).filter(p => /\/characters\//.test(p));
    for (const p of files) { const d = readJson(p); d.__source = p; const slug = d.charSlug || d.slug; out.push({ data: d, href: `/archives/character/${slug}/` }); }
  } else if (kind === 'series') {
    const files = collectJsonFiles(['src','content','archives']).filter(p => /\/series\//.test(p));
    for (const p of files) { const d = readJson(p); d.__source = p; const slug = d.seriesSlug || d.slug; out.push({ data: d, href: `/archives/series/${slug}/` }); }
  } else if (['spark','concept','project','meta'].includes(kind)) {
    const dir = kind + 's';
    const base = path.join('src','content',dir);
    if (fs.existsSync(base)) {
      const walk = (d) => {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, ent.name);
          if (ent.isDirectory()) walk(p);
          else if (ent.isFile() && /\.(md|markdown)$/i.test(p)) {
            const fileSlug = path.basename(p).replace(/\.(md|markdown)$/i,'');
            out.push({ data: { fileSlug, title: fileSlug }, href: `/${dir}/${fileSlug}/` });
          }
        }
      };
      walk(base);
    }
  }
  return out;
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

  const results = [];
  for (const item of unresolved) {
    const kinds = onlyKind ? [onlyKind] : (Array.isArray(item.attemptedKinds) && item.attemptedKinds.length ? item.attemptedKinds : routeRegistry.defaultKindsPriority);
    for (const kind of kinds) {
      if (!routeRegistry.kinds[kind]) continue;
      const dataset = datasetFor(kind);
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
