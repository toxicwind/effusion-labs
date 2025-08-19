#!/usr/bin/env node
// tools/audit-identity.mjs
// Identity-key auditor with case-insensitive + diacritic-safe normalization,
// field aliasing, value synonyms, near-duplicate clustering, and optional
// phonetic equivalence (Double/Single Metaphone if a lib is present).
//
// Usage:
//   node tools/audit-identity.mjs --file=<path>
//       [--max-combo=3] [--top=5] [--similar=0.88]
//       [--json] [--verbose] [--show-clusters] [--sample=3]
//       [--synonyms=path/to/synonyms.json] [--use-phonetic]
//
// Optional dev deps for --use-phonetic:
//   npm i -D natural        # prefers DoubleMetaphone/Metaphone
//   # or
//   npm i -D double-metaphone

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const requireCjs = createRequire(import.meta.url);

// ---------------- args ----------------
function parseArgs(argv) {
  const out = {
    file: null,
    maxCombo: 3,
    top: 5,
    similar: 0.88,
    json: false,
    verbose: false,
    showClusters: false,
    sample: 3,
    synonymsPath: null,
    usePhonetic: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--show-clusters') out.showClusters = true;
    else if (a === '--use-phonetic') out.usePhonetic = true;
    else if (a.startsWith('--file=')) out.file = a.slice(7);
    else if (a === '--file') out.file = argv[++i];
    else if (a.startsWith('--max-combo=')) out.maxCombo = parseInt(a.slice(12), 10);
    else if (a === '--max-combo') out.maxCombo = parseInt(argv[++i], 10);
    else if (a.startsWith('--top=')) out.top = parseInt(a.slice(6), 10);
    else if (a === '--top') out.top = parseInt(argv[++i], 10);
    else if (a.startsWith('--similar=')) out.similar = parseFloat(a.slice(10));
    else if (a === '--similar') out.similar = parseFloat(argv[++i]);
    else if (a.startsWith('--sample=')) out.sample = parseInt(a.slice(9), 10);
    else if (a === '--sample') out.sample = parseInt(argv[++i], 10);
    else if (a.startsWith('--synonyms=')) out.synonymsPath = a.slice(11);
    else if (a === '--synonyms') out.synonymsPath = argv[++i];
  }
  return out;
}
const args = parseArgs(process.argv);
if (!args.file) {
  console.log('Usage: node tools/audit-identity.mjs --file=<path> [--max-combo=3] [--top=5] [--json] [--verbose] [--show-clusters] [--sample=3] [--similar=0.88] [--synonyms=path] [--use-phonetic]');
  process.exit(1);
}

// -------------- optional phonetic --------------
let phonetic = null; // function(word) -> string|string[]
if (args.usePhonetic) {
  try {
    const natural = requireCjs('natural');
    if (natural?.DoubleMetaphone) {
      if (typeof natural.DoubleMetaphone.process === 'function') {
        phonetic = (w) => natural.DoubleMetaphone.process(w);        // -> [primary, secondary]
      } else if (typeof natural.DoubleMetaphone === 'function') {
        phonetic = (w) => natural.DoubleMetaphone(w);                 // -> [primary, secondary]
      }
    }
    if (!phonetic && natural?.Metaphone) {
      if (typeof natural.Metaphone.process === 'function') {
        phonetic = (w) => natural.Metaphone.process(w);               // -> string
      } else if (typeof natural.Metaphone === 'function') {
        phonetic = (w) => natural.Metaphone(w);                       // -> string
      }
    }
  } catch {}
  if (!phonetic) {
    try {
      const dm = requireCjs('double-metaphone');                      // -> [primary, secondary]
      phonetic = (w) => dm(w);
    } catch {
      console.warn('[audit-identity] "--use-phonetic" requested but no phonetic lib found. Install "natural" or "double-metaphone". Skipping phonetic step.');
    }
  }
}

// ---------------- normalization ----------------
const stripDiacritics = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const baseNorm = (v) => {
  if (v == null) return '';
  let s = String(v);
  s = stripDiacritics(s)
    .toLowerCase()
    .replace(/\s*&\s*/g, ' and ')
    .replace(/["'’`´]/g, '')
    .replace(/[(){}\[\]]/g, ' ')
    .replace(/[#/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bv[\s\-]*([0-9]+)\b/g, 'v$1')
    .replace(/\bvol(?:ume)?\s*([0-9]+)\b/g, 'v$1')
    .replace(/\bver(?:sion)?\s*([0-9]+)\b/g, 'v$1');
  return s;
};
const tokenized = (s) => {
  s = baseNorm(s);
  return s ? s.split(/\s+/).filter(Boolean) : [];
};

// ---------------- synonyms ----------------
const defaultSynonyms = {
  'angel in clouds': [
    'angel in the clouds', 'angel-in-clouds', 'angel-in-the-clouds',
    'aic', 'angel clouds', '天使在云端', 'angel in clouds v2', 'angel in the clouds v2',
    'angel in clouds (v2)', 'angel in the clouds (v2)'
  ],
  'time to chill': ['time-to-chill', 'time2chill', 'time 2 chill', 'ttc'],
  'best of luck': ['best-of-luck', '好运连连', 'good luck to you (overseas)', 'good lucky to you (overseas)'],
  'walk by fortune': ['walk-by-fortune', 'walk with fortune', '行运', 'walk of fortune'],
};
let userSynonyms = {};
if (args.synonymsPath) {
  const p = path.resolve(args.synonymsPath);
  if (!fs.existsSync(p)) {
    console.warn(`[audit-identity] synonyms file not found: ${p}`);
  } else {
    try { userSynonyms = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.warn(`[audit-identity] failed to parse synonyms JSON: ${e.message}`); }
  }
}
function buildSynCanonMap(dicts) {
  const map = new Map();
  for (const d of dicts) {
    for (const [canon, arr] of Object.entries(d)) {
      const canonN = baseNorm(canon);
      if (!canonN) continue;
      map.set(canonN, canonN);
      for (const v of (arr || [])) {
        const n = baseNorm(v);
        if (n) map.set(n, canonN);
      }
    }
  }
  return map;
}
const synonymsCanonMap = buildSynCanonMap([defaultSynonyms, userSynonyms]);

// ---------------- helpers ----------------
function equivalenceKey(raw, field, opts) {
  const bn = baseNorm(raw);
  if (!bn) return '';
  let syn = bn;
  // full phrase
  if (opts.synonymsCanonMap.has(bn)) syn = opts.synonymsCanonMap.get(bn);
  // token-level
  if (syn === bn) {
    const toks = tokenized(bn).map(t => opts.synonymsCanonMap.get(t) || t);
    syn = toks.join(' ');
  }
  // phonetic
  if (opts.usePhonetic && typeof phonetic === 'function') {
    const toks = syn.split(/\s+/).filter(Boolean).map(t => {
      const codes = phonetic(t);
      return Array.isArray(codes) ? codes.filter(Boolean).join('-') : (codes || t);
    });
    syn = toks.join(' ');
  }
  return syn.replace(/\s+/g, ' ').trim();
}
const joinKey = (vals, opts, fieldName) =>
  vals.map(v => equivalenceKey(v, fieldName, opts)).filter(Boolean).join(' | ');

function globLast(pattern) {
  const dir = path.dirname(pattern);
  const base = path.basename(pattern).replace(/\./g, '\\.').replace(/\*/g, '.*');
  const re = new RegExp('^' + base + '$', 'i');
  const files = fs.readdirSync(dir).filter(f => re.test(f));
  if (!files.length) return null;
  files.sort();
  return path.join(dir, files[files.length - 1]);
}

// Jaro-Winkler + token Jaccard
function jaroWinkler(a, b) {
  a = a || ''; b = b || '';
  if (!a || !b) return 0;
  const mt = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aM = new Array(a.length).fill(false);
  const bM = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - mt);
    const end = Math.min(i + mt + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bM[j]) continue;
      if (a[i] !== b[j]) continue;
      aM[i] = true; bM[j] = true; m++; break;
    }
  }
  if (m === 0) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;
  const j = (m / a.length + m / b.length + (m - t) / m) / 3;
  let l = 0; while (l < 4 && a[l] === b[l]) l++;
  return j + l * 0.1 * (1 - j);
}
function jaccard(a, b) {
  const A = new Set(tokenized(a));
  const B = new Set(tokenized(b));
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

// Union-Find
class UF {
  constructor(n) { this.p = Array.from({ length: n }, (_, i) => i); this.r = new Array(n).fill(0); }
  find(x){ return this.p[x]===x?x:this.p[x]=this.find(this.p[x]); }
  union(a,b){ a=this.find(a); b=this.find(b); if(a===b) return;
    if(this.r[a]<this.r[b]) this.p[a]=b;
    else if(this.r[a]>this.r[b]) this.p[b]=a;
    else { this.p[b]=a; this.r[a]++; }
  }
}

// Field aliasing
const ALIAS_GROUPS = [
  ['title', 'product_title', 'product', 'product_title_(marketing_title_+_normalized_title)', 'product_title_(marketing_+_normalized)', 'product_title_(marketing_+_normalized_title)'],
  ['variant', 'variant_name', 'variant_name_(colorway,_pose,_outfit)'],
  ['series', 'collection', 'series_hub_link'],
  ['line'],
  ['brand'],
  ['character'],
  ['product_id', 'deterministic_id', 'sku', 'sku/model_code', 'sku/model', 'product_code', 'deterministic_product_id_components', 'barcode', 'barcode/ean/upc'],
];
const canonicalFieldName = (field) => {
  const f = field.toLowerCase();
  for (const g of ALIAS_GROUPS) if (g.some(x => x.toLowerCase() === f)) return g[0];
  return field;
};
function expandFieldSet(canonFields, allKeys) {
  const set = new Set(canonFields.map(canonicalFieldName));
  const expanded = new Set();
  for (const key of allKeys) {
    const canon = canonicalFieldName(key);
    if (set.has(canon)) expanded.add(key);
  }
  return Array.from(expanded);
}

// --------------- data load ---------------
const fileArg = args.file.includes('*') ? (globLast(args.file) || args.file) : args.file;
const filePath = path.resolve(fileArg);
if (!fs.existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1); }
let records;
try {
  records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(records)) throw new Error('root should be an array');
} catch (e) {
  console.error('Failed to parse JSON:', e.message);
  process.exit(1);
}
const N = records.length;

// --------------- scoring ---------------
const allFields = Array.from(
  records.reduce((s, r) => { Object.keys(r || {}).forEach(k => s.add(k)); return s; }, new Set())
).sort();

const opts = { synonymsCanonMap, usePhonetic: !!(args.usePhonetic && phonetic) };

function coverageAndUniques(fieldList, opts) {
  const seen = new Set(); let covered = 0;
  for (const r of records) {
    const keyVals = fieldList.map(f => r?.[f]).filter(v => v != null && String(v).trim() !== '');
    if (keyVals.length > 0) { covered++; seen.add(joinKey(keyVals, opts)); }
  }
  return { coverage: covered / N, uniques: seen.size };
}
function scoreIdentity(fieldList, opts) {
  const { coverage, uniques } = coverageAndUniques(fieldList, opts);
  const uniqueness = uniques / N;
  const sizePenalty = 1 - (fieldList.length - 1) * 0.07;
  const score = (coverage * 0.55 + uniqueness * 0.45) * Math.max(0.6, sizePenalty);
  return { score, coverage, uniques };
}
const canonicalTop = Array.from(new Set(allFields.map(canonicalFieldName)));
const candidates = [];
for (const f of canonicalTop) {
  const expanded = expandFieldSet([f], allFields);
  if (!expanded.length) continue;
  const m = scoreIdentity(expanded, opts);
  candidates.push({ fields: expanded, canonical: [f], ...m });
}
for (let k = 2; k <= Math.max(2, args.maxCombo); k++) {
  for (const comboCanonical of combinations(canonicalTop, k)) {
    const expanded = expandFieldSet(comboCanonical, allFields);
    if (!expanded.length) continue;
    const m = scoreIdentity(expanded, opts);
    candidates.push({ fields: expanded, canonical: comboCanonical, ...m });
  }
}
candidates.sort((a, b) => b.score - a.score);

// --------------- stats ---------------
function duplicationStats() {
  const stats = [];
  for (const f of allFields) {
    let present = 0; const freq = new Map();
    for (const r of records) {
      const v = r?.[f];
      if (v == null || String(v).trim() === '') continue;
      present++;
      const k = equivalenceKey(v, f, opts);
      freq.set(k, (freq.get(k) || 0) + 1);
    }
    if (!present) continue;
    const maxCount = Math.max(0, ...freq.values());
    stats.push({ field: f, coverage: present / N, uniques: freq.size, majority: maxCount / present });
  }
  stats.sort((a, b) => b.majority - a.majority || a.field.localeCompare(b.field));
  return stats;
}
function combinations(arr, k) {
  const res = []; const rec = (start, combo) => {
    if (combo.length === k) { res.push(combo.slice()); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); rec(i + 1, combo); combo.pop(); }
  };
  rec(0, []); return res;
}

// ---------- token-blocking for fast candidate pairs ----------
const DF_CUTOFF = 40;      // ignore very common tokens
const LEN_DELTA_MAX = 6;   // cheap length filter

function buildTokenIndex(values) {
  const df = new Map();
  const toks = values.map(s => tokenized(s));
  for (const ts of toks) {
    const uniq = new Set(ts);
    for (const t of uniq) df.set(t, (df.get(t) || 0) + 1);
  }
  return { toks, df };
}
function* candidatePairs(values) {
  const { toks, df } = buildTokenIndex(values);
  const inv = new Map();
  for (let i = 0; i < toks.length; i++) {
    for (const t of new Set(toks[i])) {
      if ((df.get(t) || 0) > DF_CUTOFF) continue;
      const arr = inv.get(t) || []; arr.push(i); inv.set(t, arr);
    }
  }
  const yielded = new Set();
  for (const arr of inv.values()) {
    for (let a = 0; a < arr.length; a++) {
      for (let b = a + 1; b < arr.length; b++) {
        const i = arr[a], j = arr[b];
        const key = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (yielded.has(key)) continue;
        if (Math.abs(values[i].length - values[j].length) > LEN_DELTA_MAX) continue;
        yielded.add(key);
        yield [i, j];
      }
    }
  }
}

// --------------- clustering ---------------
function buildClustersFor(fields, similar, sample) {
  const keys = records.map((r) => {
    const vals = fields.map(f => r?.[f]).filter(v => v != null && String(v).trim() !== '');
    return joinKey(vals, opts);
  });
  const idxs = [], nonEmpty = [];
  keys.forEach((k, i) => { if (k) { idxs.push(i); nonEmpty.push(k); } });

  const uf = new UF(nonEmpty.length);
  // exact groups
  const byExact = new Map();
  nonEmpty.forEach((k, i) => { const a = byExact.get(k) || []; a.push(i); byExact.set(k, a); });
  for (const g of byExact.values()) for (let i = 1; i < g.length; i++) uf.union(g[0], g[i]);

  // near dup via blocking
  for (const [i, j] of candidatePairs(nonEmpty)) {
    if (uf.find(i) === uf.find(j)) continue;
    const a = nonEmpty[i], b = nonEmpty[j];
    const sim = Math.max(jaroWinkler(a, b), jaccard(a, b));
    if (sim >= similar) uf.union(i, j);
  }

  const groups = new Map();
  for (let i = 0; i < nonEmpty.length; i++) {
    const root = uf.find(i);
    const g = groups.get(root) || []; g.push(i); groups.set(root, g);
  }

  const clusters = [];
  for (const g of groups.values()) {
    if (g.length <= 1) continue;
    const members = g.map(li => ({
      recIndex: idxs[li],
      key: nonEmpty[li],
      rawTitle: records[idxs[li]]?.title ?? records[idxs[li]]?.product_title ?? null,
    }));
    const rep = members.reduce((a, b) => (b.key.length > a.key.length ? b : a), members[0]);
    const sims = members.map(m => Math.max(jaroWinkler(m.key, rep.key), jaccard(m.key, rep.key)));
    const avgSim = sims.reduce((x, y) => x + y, 0) / sims.length;
    clusters.push({ representative: rep.key, size: members.length, avgSimilarity: Number(avgSim.toFixed(3)), sample: members.slice(0, sample) });
  }
  clusters.sort((a, b) => b.size - a.size || b.avgSimilarity - a.avgSimilarity);
  return clusters;
}

function crossFieldNearDupes(similar, sample) {
  const out = [];
  for (const group of ALIAS_GROUPS) {
    const present = group.filter(g => allFields.includes(g));
    if (present.length < 2) continue;

    const vals = [], recIdxs = [];
    for (let i = 0; i < N; i++) {
      const r = records[i];
      const vs = present.map(f => r?.[f]).filter(v => v != null && String(v).trim() !== '');
      const norm = Array.from(new Set(vs.map(v => equivalenceKey(v, null, opts)))).filter(Boolean);
      for (const v of norm) { vals.push(v); recIdxs.push(i); }
    }
    if (vals.length < 2) continue;

    const uf = new UF(vals.length);
    const byExact = new Map();
    vals.forEach((v, i) => { const a = byExact.get(v) || []; a.push(i); byExact.set(v, a); });
    for (const a of byExact.values()) for (let i = 1; i < a.length; i++) uf.union(a[0], a[i]);

    for (const [i, j] of candidatePairs(vals)) {
      if (uf.find(i) === uf.find(j)) continue;
      const sim = Math.max(jaroWinkler(vals[i], vals[j]), jaccard(vals[i], vals[j]));
      if (sim >= similar) uf.union(i, j);
    }

    const groups = new Map();
    for (let i = 0; i < vals.length; i++) {
      const root = uf.find(i);
      const g = groups.get(root) || []; g.push(i); groups.set(root, g);
    }
    const clusters = [];
    for (const g of groups.values()) {
      if (g.length <= 1) continue;
      const members = g.map(ix => ({
        value: vals[ix],
        recIndex: recIdxs[ix],
        title: records[recIdxs[ix]]?.title ?? records[recIdxs[ix]]?.product_title ?? null,
      }));
      const rep = members.reduce((a, b) => (b.value.length > a.value.length ? b : a), members[0]);
      const sims = members.map(m => Math.max(jaroWinkler(m.value, rep.value), jaccard(m.value, rep.value)));
      const avgSim = sims.reduce((x, y) => x + y, 0) / sims.length;
      clusters.push({ representative: rep.value, size: members.length, avgSimilarity: Number(avgSim.toFixed(3)), sample: members.slice(0, sample) });
    }
    if (clusters.length) {
      clusters.sort((a, b) => b.size - a.size || b.avgSimilarity - a.avgSimilarity);
      out.push({ aliasGroup: present, clusters });
    }
  }
  return out;
}

// ---------------- compute & output ----------------
const dupStats = duplicationStats();
const topCandidates = candidates.slice(0, args.top);
const best = topCandidates[0] || null;

const result = {
  file: path.relative(process.cwd(), filePath),
  records: N,
  options: {
    similar: args.similar,
    usePhonetic: !!(args.usePhonetic && phonetic),
    synonymsLoaded: args.synonymsPath ? path.relative(process.cwd(), path.resolve(args.synonymsPath)) : '(default only)'
  },
  suggestedIdentity: best ? {
    canonical: best.canonical,
    fields: best.fields,
    coverage: best.coverage,
    uniques: best.uniques,
    score: Number(best.score.toFixed(4))
  } : null,
  candidates: topCandidates.map(c => ({
    canonical: c.canonical,
    fields: c.fields,
    coverage: c.coverage,
    uniques: c.uniques,
    score: Number(c.score.toFixed(4)),
  })),
  highlyDuplicatedFields: dupStats.slice(0, 14).map(d => ({
    field: d.field,
    coveragePct: Number((d.coverage * 100).toFixed(1)),
    uniques: d.uniques,
    majoritySharePct: Number((d.majority * 100).toFixed(1))
  })),
};

if (args.showClusters && best) {
  result.duplicateClustersForBest = buildClustersFor(best.fields, args.similar, args.sample);
  result.crossFieldNearDuplicates = crossFieldNearDupes(args.similar, args.sample);
}

function pct(x) { return (x * 100).toFixed(1) + '%'; }

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Golden used: ${result.file}`);
  console.log(`Records: ${result.records}`);
  console.log(`Options: similar=${args.similar} usePhonetic=${!!(args.usePhonetic && phonetic)} synonyms=${result.options.synonymsLoaded}\n`);

  if (result.suggestedIdentity) {
    const s = result.suggestedIdentity;
    console.log(`Best identity: ${JSON.stringify(s.canonical)}\n  fields=${s.fields.join(', ')}\n  coverage=${pct(s.coverage)} uniques=${s.uniques}/${N} score=${s.score}\n`);
  } else {
    console.log('No identity suggestion could be made.\n');
  }

  console.log('Top candidates:');
  for (const c of result.candidates) {
    console.log(`  - ${JSON.stringify(c.canonical)} (fields:${c.fields.length}) coverage=${pct(c.coverage)} uniques=${c.uniques}/${N} score=${c.score}`);
  }

  console.log('\nHighly duplicated fields (poor identity):');
  for (const d of result.highlyDuplicatedFields) {
    console.log(`  - ${d.field} (majority=${d.majoritySharePct}%, coverage=${d.coveragePct}%, uniques=${d.uniques})`);
  }

  if (args.showClusters && best) {
    console.log(`\nDuplicate clusters for best (${best.fields.join(' + ')}):`);
    const cl = result.duplicateClustersForBest || [];
    if (!cl.length) console.log('  (none)');
    for (const g of cl) {
      console.log(`  * size=${g.size} avgSim=${g.avgSimilarity} rep="${g.representative}"`);
      for (const s of g.sample) {
        console.log(`      · [#${s.recIndex}] ${s.rawTitle ?? '(no title)'}  key="${s.key}"`);
      }
    }

    console.log('\nCross-field near-duplicates (by alias groups):');
    const x = result.crossFieldNearDuplicates || [];
    if (!x.length) console.log('  (none)');
    for (const block of x) {
      console.log(`  Group: [${block.aliasGroup.join(', ')}]`);
      for (const g of block.clusters.slice(0, 8)) {
        console.log(`    - size=${g.size} avgSim=${g.avgSimilarity} rep="${g.representative}"`);
        for (const s of g.sample) {
          console.log(`        · [#${s.recIndex}] ${s.title ?? '(no title)'}  "${s.value}"`);
        }
      }
    }
  }
}
