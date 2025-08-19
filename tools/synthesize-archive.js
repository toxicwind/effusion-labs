const fs = require('fs');
const path = require('path');

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
  'market_intelligence'
];

function parseRecords(text, source) {
  const blocks = text.split(/\n\*{3}\n/g);
  const records = [];
  for (const block of blocks) {
    if (!block.match(/\n\s*[1-9][\).]/)) continue;
    const lines = block.split(/\n/).map(l => l.trim());
    let name = null;
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith('[')) {
        const m = line.match(/\[(.*?)\]/);
        if (m) name = m[1];
        break;
      }
      if (line.startsWith('**')) {
        name = line.replace(/\*+/g, '').trim();
        break;
      }
    }
    if (!name) continue;
    const fields = {};
    const fieldRegex = /\n?\s*(\d+)[\).]\s*([^]+?)(?=\n\s*\d+[\).]|$)/g;
    let match;
    while ((match = fieldRegex.exec(block)) !== null) {
      const idx = parseInt(match[1], 10) - 1;
      if (idx >= 0 && idx < schemaFields.length) {
        fields[schemaFields[idx]] = match[2].trim();
      }
    }
    const record = {
      product: name.trim(),
      ...schemaFields.reduce((acc, f) => ({ ...acc, [f]: fields[f] || null }), {}),
      deltas: [],
      sources: [source]
    };
    records.push(record);
  }
  return records;
}

function mergeRecords(records) {
  const map = new Map();
  for (const rec of records) {
    if (!map.has(rec.product)) {
      map.set(rec.product, rec);
      continue;
    }
    const existing = map.get(rec.product);
    for (const field of schemaFields) {
      const newVal = rec[field];
      const oldVal = existing[field];
      if (newVal && (!oldVal || newVal.length > oldVal.length)) {
        if (oldVal && newVal !== oldVal) {
          existing.deltas.push({ field, chosen: newVal, discarded: oldVal, reason: 'specificity' });
        }
        existing[field] = newVal;
      }
    }
    existing.sources = Array.from(new Set([...existing.sources, ...rec.sources]));
  }
  return Array.from(map.values());
}

function main() {
  const files = [
    'research/COMPLETED SEEDS.txt',
    'research/PRIMARY TARGETS — Completed(1).txt',
    'research/PRIMARY TARGETS — Completed(2).txt'
  ];
  let allRecords = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    allRecords = allRecords.concat(parseRecords(content, file));
  }
  const merged = mergeRecords(allRecords);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const timestamp = now.slice(0,8) + '-' + now.slice(9,15);
  const outPath = path.join('docs', 'knowledge', `synthesized_archive-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
  console.log(outPath);
}

if (require.main === module) {
  main();
}
