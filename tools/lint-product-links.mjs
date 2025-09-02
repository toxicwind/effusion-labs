#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('artifacts','reports');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'product-link-hygiene.json');

const deepPattern = /\/archives\/collectables\/.+\/products\//;

function walk(dir){
  const out=[];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile() && /\.(njk|md|html|11ty\.js)$/.test(p)) out.push(p);
  }
  return out;
}

const findings=[];
for (const f of walk('src')){
  const src = fs.readFileSync(f, 'utf8');
  if (deepPattern.test(src)) findings.push({ file: f });
}
fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), count: findings.length, findings }, null, 2));
console.log('Advisory product link hygiene report:', outFile, 'count=', findings.length);
