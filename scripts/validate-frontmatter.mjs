#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const normalizeTitle = (t) => {
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) return t.filter((v) => v != null).map(String).join(' / ');
  if (t && typeof t === 'object') return String(t.name ?? '');
  return '';
};

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const res = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(res);
    } else {
      yield res;
    }
  }
}

const files = [];
for await (const f of walk('src')) {
  if (/\.(md|njk|html)$/i.test(f)) files.push(f);
}

const errors = [];
for (const file of files) {
  const txt = await fs.readFile(file, 'utf8');
  if (!txt.startsWith('---')) continue;
  const end = txt.indexOf('\n---', 3);
  if (end === -1) continue;
  const fm = txt.slice(3, end).split(/\r?\n/);
  let idx = fm.findIndex((l) => /^title\s*:/i.test(l));
  if (idx === -1) continue;
  const lineNo = idx + 1;
  let line = fm[idx];
  let value = line.replace(/^title\s*:/i, '').trim();
  let block = [];
  if (!value) {
    let j = idx + 1;
    while (j < fm.length && /^\s/.test(fm[j])) {
      block.push(fm[j]);
      j++;
    }
    value = block.join('\n');
  }
  let parsed;
  if (value.startsWith('[') || block.some((l) => l.trim().startsWith('-'))) {
    parsed = block.length ? block.map((l) => l.trim().replace(/^[-]\s*/, '')) : JSON.parse(value);
  } else if (value.startsWith('{') || block.some((l) => l.includes(':'))) {
    let obj = {};
    const lines = block.length ? block : [value];
    for (const l of lines) {
      const m = l.trim().match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (m) obj[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    parsed = obj;
  } else {
    parsed = value.replace(/^['"]|['"]$/g, '');
  }
  const normalized = normalizeTitle(parsed);
  if (typeof normalized !== 'string' || normalized.length === 0) {
    errors.push(`${file}:${lineNo} title must resolve to a string`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
