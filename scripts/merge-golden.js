#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const slugify = require('slugify');
const crypto = require('crypto');

const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  keepOld: args.includes('--keep-old'),
  verbose: args.includes('--verbose'),
};

const repoRoot = path.resolve(__dirname, '..');

function log(...msg) {
  console.log(...msg);
}

function readJSON(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    errors.push({ file, err: err.message });
    return null;
  }
}

function writeJSON(file, obj) {
  const content = JSON.stringify(obj, null, 2);
  if (options.dryRun) return;
  fs.writeFileSync(file, content + '\n');
}

function slug(val) {
  if (!val) return '';
  return slugify(String(val), { lower: true, strict: true });
}

function removeTimestamp(name) {
  const re = /(.*?)(--\d{8}(?:T\d{6}Z)?)\.json$/;
  const m = name.match(re);
  if (m) return m[1] + '.json';
  return null;
}

function parseTimestamp(name) {
  const re = /--(\d{8}(?:T\d{6}Z)?)\.json$/;
  const m = name.match(re);
  return m ? m[1] : null;
}

function deepMerge(target, source, conflicts = []) {
  if (Array.isArray(target) && Array.isArray(source)) {
    const combined = [...target];
    source.forEach((item) => {
      if (!combined.some((c) => JSON.stringify(c) === JSON.stringify(item))) {
        combined.push(item);
      }
    });
    return combined;
  }
  if (isObject(target) && isObject(source)) {
    const result = { ...target };
    Object.keys(source).forEach((key) => {
      const srcVal = source[key];
      const tgtKey = findKeyCaseInsensitive(result, key);
      const actualKey = tgtKey || key;
      const tgtVal = result[actualKey];
      if (srcVal === null) {
        result[actualKey] = null;
      } else if (isObject(srcVal) && isObject(tgtVal)) {
        result[actualKey] = deepMerge(tgtVal, srcVal, conflicts);
      } else if (Array.isArray(srcVal) && Array.isArray(tgtVal)) {
        result[actualKey] = deepMerge(tgtVal, srcVal, conflicts);
      } else {
        if (srcVal !== '' && srcVal !== undefined) {
          if (
            tgtVal !== undefined &&
            tgtVal !== '' &&
            JSON.stringify(tgtVal) !== JSON.stringify(srcVal)
          ) {
            conflicts.push({ key: actualKey, old: tgtVal, new: srcVal });
          }
          result[actualKey] = srcVal;
        }
      }
    });
    return result;
  }
  return source;
}

function isEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isObject(o) {
  return o && typeof o === 'object' && !Array.isArray(o);
}

function findKeyCaseInsensitive(obj, key) {
  const lower = key.toLowerCase();
  return Object.keys(obj).find((k) => k.toLowerCase() === lower);
}

function majorityKeyCase(stats, key) {
  const lower = key.toLowerCase();
  const variants = stats[lower];
  if (!variants) return key;
  let best = key;
  let max = 0;
  Object.entries(variants).forEach(([k, count]) => {
    if (count > max) {
      max = count;
      best = k;
    }
  });
  return best;
}

let errors = [];

// --- Audit phase ---

// discover golden record files
const goldenFiles = glob.sync('**/golden_record_*.json', {
  cwd: repoRoot,
  ignore: ['node_modules/**', '_site/**'],
});
if (goldenFiles.length === 0) {
  console.error('No golden record files found');
  process.exit(1);
}

function tsFromName(name) {
  const m = name.match(/golden_record_(\d{8}(?:T\d{6}Z)?)\.json$/);
  return m ? m[1] : '00000000';
}
const latestGolden = goldenFiles.sort((a, b) => (tsFromName(a) > tsFromName(b) ? 1 : -1)).pop();
const goldenPath = path.join(repoRoot, latestGolden);

const goldenRowsRaw = readJSON(goldenPath) || [];
function isGoldenProduct(row) {
  if (!row || typeof row !== 'object') return false;
  const name = row.product || '';
  if (/^\^/.test(name)) return false;
  const idt = row.sections && row.sections.identity_taxonomy;
  return !!idt && Object.keys(idt).length > 0;
}
const goldenRows = goldenRowsRaw.filter(isGoldenProduct);

// discover product files
const allJson = glob.sync('**/*.json', {
  cwd: repoRoot,
  ignore: ['node_modules/**', '_site/**', '**/golden_record_*.json'],
});
const productFiles = [];
const keyFreq = {};
const keyCaseStats = {};
const brandLineDir = {};
let timestampedCount = 0;
allJson.forEach((rel) => {
  const file = path.join(repoRoot, rel);
  const data = readJSON(file);
  if (!data || data.type !== 'product') return;
  productFiles.push(rel);
  Object.keys(data).forEach((k) => {
    keyFreq[k] = (keyFreq[k] || 0) + 1;
    const lower = k.toLowerCase();
    keyCaseStats[lower] = keyCaseStats[lower] || {};
    keyCaseStats[lower][k] = (keyCaseStats[lower][k] || 0) + 1;
  });
  if (data.brand && data.line) {
    const key = `${data.brand}|${data.line}`;
    const dir = path.dirname(rel);
    brandLineDir[key] = dir;
  }
  const ts = parseTimestamp(path.basename(rel));
  if (ts) timestampedCount++;
});

const topKeys = Object.entries(keyFreq)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([k, v]) => `${k} (${v})`);

// identity key detection
const goldenKeyFreq = {};
for (const row of goldenRows) {
  const idt = row.sections.identity_taxonomy;
  Object.keys(idt).forEach((k) => {
    goldenKeyFreq[k] = (goldenKeyFreq[k] || 0) + 1;
  });
}
const identityKeys = Object.keys(keyFreq).filter((k) => goldenKeyFreq[k]);

log('Golden used:', latestGolden);
log('Product files:', productFiles.length);
log('Golden product rows:', goldenRows.length);
log('Identity keys:', identityKeys.join(', '));
log('Timestamped files:', timestampedCount);
log('Top keys:', topKeys.join(', '));

// --- Canonicalization ---
let willRename = 0;
let willDeleteTimestamped = 0;
let willMerge = 0;
let willCreate = 0;
let skippedNonProduct = goldenRowsRaw.length - goldenRows.length;

const canonicalMap = {};
productFiles.forEach((rel) => {
  const name = path.basename(rel);
  const canonical = removeTimestamp(name);
  const key = canonical ? path.join(path.dirname(rel), canonical) : rel;
  canonicalMap[key] = canonicalMap[key] || [];
  canonicalMap[key].push(rel);
});

for (const [canonical, files] of Object.entries(canonicalMap)) {
  const absCanonical = path.join(repoRoot, canonical);
  let baseFile = canonical;
  let existing = fs.existsSync(absCanonical);
  let candidates = files.filter((f) => f !== canonical);
  if (!existing && candidates.length > 0) {
    // choose latest timestamped as base
    candidates.sort((a, b) => {
      const ta = parseTimestamp(path.basename(a)) || '0';
      const tb = parseTimestamp(path.basename(b)) || '0';
      return ta.localeCompare(tb);
    });
    baseFile = candidates.pop();
    candidates = candidates.filter((f) => f !== baseFile);
    // rename baseFile to canonical
    const src = path.join(repoRoot, baseFile);
    if (options.dryRun) {
      log('rename', baseFile, '->', canonical);
    } else {
      fs.renameSync(src, absCanonical);
      log('rename', baseFile, '->', canonical);
    }
    willRename++;
    existing = true;
  }
  // merge timestamped siblings
  for (const f of candidates) {
    const abs = path.join(repoRoot, f);
    const targetData = readJSON(absCanonical) || {};
    const srcData = readJSON(abs) || {};
    const conflicts = [];
    const merged = deepMerge(targetData, srcData, conflicts);
    if (!merged.__meta) merged.__meta = {};
    merged.__meta.last_merged_at = new Date().toISOString();
    merged.__meta.last_golden_source = path.relative(repoRoot, goldenPath);
    if (options.verbose && conflicts.length) {
      conflicts.forEach((c) => log('conflict', canonical, c.key, c.old, '->', c.new));
    }
    if (!options.dryRun) {
      if (!isEqual(targetData, merged)) {
        writeJSON(absCanonical, merged);
        log('merge', f, '->', canonical);
      }
    }
    if (options.keepOld) {
      const hash = crypto.createHash('sha1').update(f).digest('hex').slice(0, 8);
      const bak = abs + `.bak.${hash}`;
      if (!options.dryRun) fs.renameSync(abs, bak);
    } else {
      if (!options.dryRun) fs.unlinkSync(abs);
    }
    willMerge++;
    willDeleteTimestamped++;
  }
}

// rebuild product map after canonicalization
const finalProductFiles = glob.sync('**/*.json', {
  cwd: repoRoot,
  ignore: ['node_modules/**', '_site/**', '**/golden_record_*.json'],
}).filter((rel) => {
  const data = readJSON(path.join(repoRoot, rel));
  return data && data.type === 'product';
});

const identityMap = {};
finalProductFiles.forEach((rel) => {
  const data = readJSON(path.join(repoRoot, rel));
  const id = identityKeys
    .map((k) => slug(data[k]))
    .filter(Boolean)
    .join('|');
  if (id) {
    identityMap[id] = identityMap[id] || [];
    identityMap[id].push(rel);
  }
});

function selectFile(candidates) {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // prefer canonical (no timestamp)
  const noTs = candidates.find((f) => !parseTimestamp(path.basename(f)));
  if (noTs) return noTs;
  // else choose latest timestamp
  return candidates.sort((a, b) => {
    const ta = parseTimestamp(path.basename(a)) || '0';
    const tb = parseTimestamp(path.basename(b)) || '0';
    return tb.localeCompare(ta);
  })[0];
}

for (const row of goldenRows) {
  const idt = row.sections.identity_taxonomy;
  const id = identityKeys
    .map((k) => slug(idt[k]))
    .filter(Boolean)
    .join('|');
  if (!id) continue;
  const file = selectFile(identityMap[id]);
  let absPath;
  if (file) {
    absPath = path.join(repoRoot, file);
    const data = readJSON(absPath) || {};
    const conflicts = [];
    const merged = deepMerge(data, row, conflicts);
    if (!merged.__meta) merged.__meta = {};
    merged.__meta.last_merged_at = new Date().toISOString();
    merged.__meta.last_golden_source = path.relative(repoRoot, goldenPath);
    if (options.verbose && conflicts.length) {
      conflicts.forEach((c) => log('conflict', file, c.key, c.old, '->', c.new));
    }
    if (!options.dryRun) {
      if (!isEqual(data, merged)) {
        writeJSON(absPath, merged);
        log('merge', file);
        willMerge++;
      }
    }
  } else {
    // create new file
    const brand = slug(idt.brand);
    const line = slug(idt.line);
    const key = `${brand}|${line}`;
    const dir = brandLineDir[key];
    if (!dir) continue;
    const nameParts = identityKeys.map((k) => slug(idt[k])).filter(Boolean);
    const filename = nameParts.join('--') + '.json';
    absPath = path.join(repoRoot, dir, filename);
    if (!options.dryRun) {
      if (fs.existsSync(absPath)) {
        const existing = readJSON(absPath) || {};
        const merged = deepMerge(existing, row, []);
        if (!merged.__meta) merged.__meta = {};
        merged.__meta.last_merged_at = new Date().toISOString();
        merged.__meta.last_golden_source = path.relative(repoRoot, goldenPath);
        merged.type = merged.type || 'product';
        if (!isEqual(existing, merged)) {
          writeJSON(absPath, merged);
          log('merge', path.relative(repoRoot, absPath));
          willMerge++;
        }
      } else {
        row.type = row.type || 'product';
        writeJSON(absPath, row);
        log('create', path.relative(repoRoot, absPath));
        willCreate++;
      }
    } else {
      willCreate++;
    }
  }
}

log('Summary:');
log(
  JSON.stringify(
    {
      willRename,
      willMerge,
      willCreate,
      willDeleteTimestamped,
      skippedNonProduct,
      errors: errors.length,
    },
    null,
    2,
  ),
);

if (errors.length) {
  console.error('Errors encountered');
  process.exit(1);
}



