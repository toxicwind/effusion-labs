// tools/merge-sections.js (or your original path)
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const files = [
  'research/COMPLETED SEEDS.txt',
  'research/PRIMARY TARGETS — Completed(2).txt',
  'research/PRIMARY TARGETS — Completed(1).txt'
];

const priority = {
  'COMPLETED SEEDS.txt': 3,
  'PRIMARY TARGETS — Completed(2).txt': 2,
  'PRIMARY TARGETS — Completed(1).txt': 1
};

function parse(content, source) {
  const lines = content.split(/\r?\n/);
  const recs = [];
  let cur = null, buf = [];

  for (const line of lines) {
    const bracket = line.match(/^\[([^\]]+)\]/);
    const bold = line.match(/^\*\*([^*]+)\*\*/);
    if (bracket || bold) {
      if (cur) { cur.raw = buf.join('\n'); recs.push(cur); buf = []; }
      const title = (bracket ? bracket[1] : bold[1]).trim();
      cur = { title, source, fields: {}, Deltas: [] };
    } else if (cur) {
      buf.push(line);
    }
  }
  if (cur) { cur.raw = buf.join('\n'); recs.push(cur); }

  for (const r of recs) {
    for (const l of r.raw.split(/\n/)) {
      const m = l.match(/[-*]?\s*([^:]+):\s*(.+)/);
      if (m) {
        const k = m[1].trim().toLowerCase().replace(/\s+/g, '_');
        r.fields[k] = m[2].trim();
      }
    }
    delete r.raw;
  }
  return recs;
}

let all = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  all = all.concat(parse(c, path.basename(f)));
}

const merged = {};
for (const r of all) {
  if (!merged[r.title]) {
    merged[r.title] = r;
  } else {
    const e = merged[r.title];
    for (const [k, v] of Object.entries(r.fields)) {
      if (!e.fields[k]) {
        e.fields[k] = v;
        e.Deltas.push({ field: k, from: null, to: v, source: r.source });
      } else if (e.fields[k] !== v) {
        const es = e.fields[k].length, ns = v.length;
        let win = e.fields[k];
        if (ns > es) win = v;
        else if (ns === es) {
          const ep = priority[e.source] || 0, np = priority[r.source] || 0;
          if (np > ep) win = v;
        }
        if (win !== e.fields[k]) {
          e.Deltas.push({ field: k, from: e.fields[k], to: win, source: r.source });
          e.fields[k] = win;
        }
      }
    }
  }
}

function schemaFromSeeds() {
  const c = fs.readFileSync('research/COMPLETED SEEDS.txt', 'utf8');
  const recs = parse(c, 'COMPLETED SEEDS.txt');
  const fields = new Set();
  recs.forEach(r => Object.keys(r.fields).forEach(f => fields.add(f)));
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      source: { type: 'string' },
      Deltas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            from: { type: ['string', 'null'] },
            to: { type: ['string', 'null'] },
            source: { type: 'string' }
          },
          required: ['field', 'from', 'to', 'source']
        }
      }
    },
    required: ['title', 'source', 'Deltas']
  };
  for (const f of fields) schema.properties[f] = { type: 'string' };
  return schema;
}

const schema = schemaFromSeeds();
const ajv = new Ajv();
const validate = ajv.compile(schema);

const final = Object.values(merged).map(r => ({
  title: r.title, source: r.source, ...r.fields, Deltas: r.Deltas
}));
for (const r of final) {
  if (!validate(r)) {
    console.error(validate.errors);
    process.exit(1);
  }
}

fs.mkdirSync('schema', { recursive: true });
fs.writeFileSync('schema/completed-seeds.schema.json', JSON.stringify(schema, null, 2));

const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '') + 'Z';
fs.mkdirSync('docs/knowledge', { recursive: true });
fs.writeFileSync(`docs/knowledge/synthesized_archive_${ts}.json`, JSON.stringify(final, null, 2));
console.log(ts);
