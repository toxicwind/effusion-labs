// tools/synthesize.mjs
import fs from 'fs';
import path from 'path';
import MarkdownIt from 'markdown-it';
import Ajv from 'ajv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const md = new MarkdownIt();

function parseFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  md.parse(text, {}); // deterministic scan
  const lines = text.split(/\r?\n/);
  const data = {};
  const regex = /^-\s*(?<key>[^:]+):\s*(?<value>.+)$/;
  for (const line of lines) {
    const match = line.match(regex);
    if (match?.groups) {
      const key = match.groups.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      data[key] = match.groups.value.trim();
    }
  }
  return data;
}

function toRows(obj, source) {
  return Object.entries(obj).map(([field, value]) => ({ field, value, source }));
}

export function synthesize() {
  const baseDir = path.join(__dirname, '..', 'research');
  const files = [
    'PRIMARY TARGETS — Completed(1).txt',
    'PRIMARY TARGETS — Completed(2).txt',
    'COMPLETED SEEDS.txt',
  ];
  const priorityMap = {
    'PRIMARY TARGETS — Completed(1).txt': 2,
    'PRIMARY TARGETS — Completed(2).txt': 1,
    'COMPLETED SEEDS.txt': 0,
  };

  const parsed = files.map(f => ({ source: f, data: parseFile(path.join(baseDir, f)) }));

  // JSON schema from seed keys
  const seedKeys = Object.keys(parsed[2].data);
  const schema = {
    type: 'object',
    properties: Object.fromEntries(seedKeys.map(k => [k, { type: 'string' }])),
    required: seedKeys,
  };

  // Flatten + score
  const rows = parsed.flatMap(p => toRows(p.data, p.source))
    .map(r => ({
      ...r,
      specificity: (r.value ?? '').length,
      priority: priorityMap[r.source] ?? 0,
    }));

  // Sort: field asc → specificity desc → priority asc
  rows.sort((a, b) => {
    if (a.field !== b.field) return a.field.localeCompare(b.field);
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    return a.priority - b.priority;
  });

  const final = {};
  const deltas = [];
  for (const rec of rows) {
    if (!(rec.field in final)) {
      final[rec.field] = rec.value;
    } else if (final[rec.field] !== rec.value) {
      deltas.push({ field: rec.field, source: rec.source, value: rec.value });
    }
  }
  final.Deltas = deltas;

  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  if (!validate(final)) {
    console.error(validate.errors);
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const outDir = path.join(__dirname, '..', 'docs', 'knowledge');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `synthesized_archive_${timestamp}.json`);
  const payload = JSON.stringify([final], null, 2);
  fs.writeFileSync(outPath, payload);
  console.log(payload);
  console.log(`Written ${outPath}`);
  return timestamp;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // invoked directly: `node tools/synthesize.mjs`
  synthesize();
}
