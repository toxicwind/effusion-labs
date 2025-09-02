#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('artifacts','reports');
fs.mkdirSync(outDir, { recursive: true });

function write(name, obj){
  const p = path.join(outDir, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  console.log('wrote', p);
}

function main(){
  const mapPath = path.join('.eleventy.js'); // not used; rely on build-time global snapshot
  // Best effort: read Eleventy-built snapshot if present, else discover from source JSON
  let items = [];
  const cache = path.join('logs','archiveProductMap.cache.json');
  if (fs.existsSync(cache)) {
    items = JSON.parse(fs.readFileSync(cache, 'utf8'));
  } else {
    // Fallback: derive minimally from source tree; not as rich but keeps command usable
    const walk = (d)=>fs.readdirSync(d, { withFileTypes: true }).flatMap(ent=>{
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) return walk(p);
      if (ent.isFile() && /\/products\/.*\.json$/.test(p)) return [p];
      return [];
    });
    const files = walk(path.join('src','content','archives'));
    const slug = (s)=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
    for (const f of files){
      const raw = JSON.parse(fs.readFileSync(f,'utf8'));
      const id = raw.product_id || path.basename(f,'.json');
      const brand = raw.brand || 'unknown';
      const line = raw.line || 'unknown';
      const character = raw.character || raw.char || '';
      const series = raw.series || raw.product_title || raw.title || '';
      const form = /plush/i.test(raw.form||'')? 'plush' : (/pendant|keychain/i.test(raw.form||'')? 'pendant' : '');
      const canon = [brand,line,character,series,form].filter(Boolean).map(slug).join('-').replace(/-+/g,'-');
      const verbose = slug(id);
      const canonicalUrl = `/archives/product/${canon}/`;
      const urlLegacy = f.replace(/^src\/content\//,'/archives/').replace(/\.json$/, '/');
      items.push({ id, title: raw.title || raw.product_title || id, slugCanonical: canon, canonicalUrl, slugAliases: verbose!==canon? [verbose]:[], legacyPaths:[urlLegacy]});
    }
  }

  // Reports
  write('archive-products.json', items);
  write('archive-products-slug-mapping.json', items.map(x=>({ id: x.id, title: x.title, slugCanonical: x.slugCanonical, slugAliases: x.slugAliases })));

  // Collisions
  const seen = new Map(); const collisions=[];
  for (const it of items){
    if (seen.has(it.slugCanonical)) collisions.push(it); else seen.set(it.slugCanonical,true);
  }
  write('archive-products-collisions.json', collisions);

  // Validation
  const errors=[]; const ok=[];
  for (const it of items){
    const good = it.slugCanonical && it.canonicalUrl && it.canonicalUrl.endsWith(`/${it.slugCanonical}/`);
    if (!good) errors.push({ id: it.id, reason: 'missing canonical fields', it }); else ok.push(it.id);
  }
  write('archive-products-jsonl-validate.json', { okCount: ok.length, errorCount: errors.length, errors });
  if (errors.length){
    write('archive-products-errors.json', errors);
    console.error('Validation failed for archive products.');
    process.exit(1);
  }

  // Coverage
  const coverage = {
    productsTotal: items.length,
    canonBuilt: items.length,
    legacyMapped: items.filter(x=> (x.legacyPaths||[]).length>0).length,
    stubsEmitted: items.reduce((a,x)=> a + (x.legacyPaths||[]).length + (x.slugAliases||[]).length, 0),
  };
  write('archive-products-coverage.json', coverage);
}

main();

