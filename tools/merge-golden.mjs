// tools/merge-golden.mjs
import fs from 'fs/promises';
import path from 'path';

function getTimestamp() {
  // YYYYMMDDTHHMMSSZ
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

async function loadRecords(file) {
  const raw = await fs.readFile(file, 'utf8');
  // Try standard JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {
    // Fallback: NDJSON (one JSON per line)
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];
    for (const line of lines) {
      try { rows.push(JSON.parse(line)); } catch { /* ignore */ }
    }
    if (rows.length) return rows;
  }
  return [];
}

async function main() {
  const knowledgeDir = path.join('docs', 'knowledge');
  const entries = await fs.readdir(knowledgeDir);
  const files = entries
    .filter(f => f.startsWith('synthesized_archive_') && f.endsWith('.json'))
    .map(f => path.join(knowledgeDir, f))
    .sort();

  const recordsMap = new Map();

  for (const file of files) {
    const records = await loadRecords(file);
    for (const record of records) {
      const key = record.title || record.product_title || record.product_id || record.id;
      if (!key) continue;
      recordsMap.set(key, recordsMap.has(key) ? { ...recordsMap.get(key), ...record } : record);
    }
  }

  const merged = Array.from(recordsMap.values());
  const ts = getTimestamp();

  const outDocs = path.join(knowledgeDir, `golden_record_${ts}.json`);
  await fs.writeFile(outDocs, JSON.stringify(merged, null, 2));

  const archiveDir = path.join('src', 'content', 'archives');
  await fs.mkdir(archiveDir, { recursive: true });
  const outSrc = path.join(archiveDir, `golden_record_${ts}.json`);
  await fs.writeFile(outSrc, JSON.stringify(merged, null, 2));

  console.log(`Wrote golden record with ${merged.length} entries to ${outDocs}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
