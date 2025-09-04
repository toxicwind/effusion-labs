import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'src');
const matches = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.isFile()) {
      const txt = fs.readFileSync(p, 'utf8');
      const reg = /href="(\/archives\/[^"\s]*\/products\/[^"\s]*\/)/g;
      let m;
      while ((m = reg.exec(txt))) {
        if (!m[1].startsWith('/archives/product/')) {
          matches.push({ file: path.relative(process.cwd(), p), href: m[1] });
        }
      }
    }
  }
}

walk(ROOT);
fs.mkdirSync('artifacts/reports', { recursive: true });
fs.writeFileSync('artifacts/reports/product-link-hygiene.json', JSON.stringify(matches, null, 2));

if (matches.length) {
  console.log(`Found ${matches.length} legacy product links.`);
} else {
  console.log('No legacy product links found.');
}
