// tools/synthesized-archive.mjs
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Schema fields in numbered order (1..N) as they appear in the source docs
const schemaFields = [
  'identity_taxonomy',
  'physical_spec',
  'packaging_inbox',
  'edition_run_info',
  'credits',
  'release_distribution',
  'regional_policy',
  'market_listings',
  'blind_box_specifics',
  'compliance_safety',
  'commerce_logistics',
  'media_assets',
  'provenance_research',
  'i18n_nomenclature',
  'relations_graph_edges',
  'market_intelligence',
];

// Sources and their merge priority (higher wins on tie)
// Keep order aligned with your original input sequence.
const sourceFiles = [
  'research/COMPLETED SEEDS.txt',
  'research/PRIMARY TARGETS — Completed(1).txt',
  'research/PRIMARY TARGETS — Completed(2).txt',
];
const sourcePriority = Object.fromEntries(
  sourceFiles.map((f, i) => [path.basename(f), sourceFiles.length - i]) // later in list ⇒ lower priority; invert so earlier is higher
);

/** ISO-like timestamp: YYYYMMDDTHHMMSSZ */
function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/** Normalize line endings and trim trailing spaces */
function normalizeText(s) {
  return s.replace(/\r\n?/g, '\n');
}

/** Extract display name from a block: [Heading] or **Heading** */
function extractName(lines) {
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('[')) {
      const m = t.match(/\[([^\]]+)\]/);
      if (m) return m[1].trim();
    }
    if (t.startsWith('**')) {
      const v = t.replace(/\*+/g, '').trim();
      if (v) return v;
    }
    // If neither match, keep scanning until we hit a title-like marker
  }
  return null;
}

/**
 * Parse numbered fields within a block.
 * Matches:
 *   1) <text possibly multi-line>
 *   2) <text>
 *   ...
 * Greedy capture until next `^\s*\d+[).]\s+` or end-of-block.
 */
function extractFields(block) {
  const fields = {};
  const rx = /(^|\n)\s*(\d+)[\).]\s+([^]*?)(?=\n\s*\d+[\).]\s+|$)/g;
  let m;
  while ((m = rx.exec(block)) !== null) {
    const idx = Number(m[2]) - 1;
    if (idx >= 0 && idx < schemaFields.length) {
      const key = schemaFields[idx];
      const val = m[3].trim();
      if (val) fields[key] = val;
    }
  }
  return fields;
}

/**
 * Split text into candidate blocks by *** separators (allow surrounding whitespace).
 * Then keep blocks that contain at least one numbered field.
 */
function splitBlocks(text) {
  const parts = text.split(/\n\s*\*{3}\s*\n/g);
  return parts.filter(p => /\n\s*[1-9][\).]/.test(p));
}

/** Parse an entire file into structured records */
function parseRecords(text, source) {
  const records = [];
  const clean = normalizeText(text);
  const blocks = splitBlocks(clean);

  for (const block of blocks) {
    const lines = block.split('\n');
    const name = extractName(lines);
    if (!name) continue;

    const fieldMap = extractFields(block);

    // Build record object with deterministic key order
    const rec = {
      product: name.trim(),
      // fill all schema fields (present or null) in canonical order
      ...Object.fromEntries(schemaFields.map(f => [f, fieldMap[f] ?? null])),
      deltas: [],
      sources: [path.basename(source)],
    };

    records.push(rec);
  }
  return records;
}

/** Merge according to: longer wins; tie → higher-priority source wins */
function mergeRecords(records) {
  const map = new Map();

  for (const rec of records) {
    const k = rec.product;
    if (!map.has(k)) {
      // Shallow clone to avoid accidental shared references
      map.set(k, {
        product: rec.product,
        ...Object.fromEntries(schemaFields.map(f => [f, rec[f]])),
        deltas: Array.isArray(rec.deltas) ? [...rec.deltas] : [],
        sources: [...new Set(rec.sources)],
      });
      continue;
    }

    const existing = map.get(k);
    for (const field of schemaFields) {
      const newVal = rec[field];
      const oldVal = existing[field];
      if (!newVal) continue;

      if (!oldVal) {
        existing[field] = newVal;
        continue;
      }

      if (newVal !== oldVal) {
        const lenNew = newVal.length;
        const lenOld = oldVal.length;

        let chooseNew = false;
        if (lenNew > lenOld) {
          chooseNew = true;
        } else if (lenNew === lenOld) {
          // Tie-break by source priority: higher wins
          const newBest = bestPriority(rec.sources);
          const oldBest = bestPriority(existing.sources);
          if (newBest > oldBest) chooseNew = true;
        }

        if (chooseNew) {
          existing.deltas.push({
            field,
            chosen: newVal,
            discarded: oldVal,
            reason: (lenNew === lenOld) ? 'priority' : 'specificity',
          });
          existing[field] = newVal;
        }
      }
    }

    // Merge unique sources
    existing.sources = [...new Set([...existing.sources, ...rec.sources])];
  }

  // Deterministic ordering by product name (case-insensitive)
  return Array.from(map.values()).sort((a, b) =>
    a.product.localeCompare(b.product, undefined, { sensitivity: 'base' })
  );
}

/** Return the highest source priority present in a list of sources */
function bestPriority(sources) {
  let best = -Infinity;
  for (const s of sources) {
    const p = sourcePriority[s] ?? 0;
    if (p > best) best = p;
  }
  return best;
}

async function main() {
  // Read all three sources (relative to repo root)
  const base = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const payloads = await Promise.all(
    sourceFiles.map(async (rel) => {
      const full = path.join(base, rel);
      const txt = await fsp.readFile(full, 'utf8');
      return parseRecords(txt, rel);
    })
  );

  const allRecords = payloads.flat();
  const merged = mergeRecords(allRecords);

  const ts = nowStamp(); // YYYYMMDDTHHMMSSZ
  const outDir = path.join(base, 'docs', 'knowledge');
  await fsp.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, `synthesized_archive_${ts}.json`);
  const json = JSON.stringify(merged, null, 2);
  await fsp.writeFile(outPath, json);
  console.log(outPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
