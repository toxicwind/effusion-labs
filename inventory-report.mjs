import fs from 'fs';
const data = JSON.parse(fs.readFileSync('docs/reports/assets-inventory.json','utf8'));
const relevant = data.filter(e => e.path.startsWith('src/') || e.type==='config');
const byHash = {};
for(const e of relevant){
  (byHash[e.hash] ||= []).push(e);
}
const duplicates = Object.values(byHash).filter(arr=>arr.length>1);
const orphans = [];
let md = '# Asset Inventory\n\n';
md += '## Duplicates\n';
for(const group of duplicates){
  md += `- ${group.map(g=>g.path).join(', ')}\n`;
}
md += '\n## Orphans\n';
for(const e of orphans){
  md += `- ${e.path}\n`;
}
fs.writeFileSync('docs/reports/assets-inventory.md', md);
