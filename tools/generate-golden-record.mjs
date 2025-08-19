import fs from 'fs/promises';
import path from 'path';
import * as dfd from 'danfojs-node';

function getTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

async function loadRecords(file) {
  const df = await dfd.readJSON(file);
  return dfd.toJSON(df);
}

async function main() {
  const knowledgeDir = path.join('docs', 'knowledge');
  const files = (await fs.readdir(knowledgeDir))
    .filter(f => f.startsWith('synthesized_archive_') && f.endsWith('.json'))
    .map(f => path.join(knowledgeDir, f))
    .sort();

  const recordsMap = new Map();
  for (const file of files) {
    const records = await loadRecords(file);
    for (const record of records) {
      const key = record.title || record.product_title || record.product_id || record.id;
      if (recordsMap.has(key)) {
        recordsMap.set(key, { ...recordsMap.get(key), ...record });
      } else {
        recordsMap.set(key, record);
      }
    }
  }

  const merged = Array.from(recordsMap.values());
  const ts = getTimestamp();
  const outDocs = path.join(knowledgeDir, `golden_record_${ts}.json`);
  await fs.writeFile(outDocs, JSON.stringify(merged, null, 2));

  const archiveDir = path.join('src', 'content', 'archives');
  const outSrc = path.join(archiveDir, `golden_record_${ts}.json`);
  await fs.writeFile(outSrc, JSON.stringify(merged, null, 2));

  console.log(`Wrote golden record with ${merged.length} entries to ${outDocs}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
