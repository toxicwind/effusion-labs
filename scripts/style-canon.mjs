import { execSync } from 'node:child_process';
import { statSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { glob } from 'node:fs/promises';
import postcss from 'postcss';

function run(cmd){ execSync(cmd,{stdio:'inherit'}); }
function runSilent(cmd){ return execSync(cmd).toString(); }

const now = new Date().toISOString().replace(/[:.]/g,'-');

// build CSS
run('npx postcss src/styles/app.tailwind.css -o src/assets/css/app.css');
const cssPath = 'src/assets/css/app.css';
const css = readFileSync(cssPath,'utf8');
const size = statSync(cssPath).size;

// size budget
const baselineFile = 'artifacts/reports/css-size-baseline.json';
let baseline = size;
if (existsSync(baselineFile)) {
  baseline = JSON.parse(readFileSync(baselineFile,'utf8')).size;
  const limit = baseline * 1.15;
  if (size > limit) {
    console.error(`CSS size ${size} exceeds budget ${limit}`);
    process.exit(1);
  }
} else {
  writeFileSync(baselineFile, JSON.stringify({size}, null, 2));
}
console.log(`CSS size: ${size} bytes (baseline ${baseline})`);

// top selectors by line count
const root = postcss.parse(css);
const rules = [];
root.walkRules(r=>{ rules.push({selector:r.selector, lines:r.toString().split('\n').length}); });
rules.sort((a,b)=>b.lines-a.lines);
console.log('Top selectors:', rules.slice(0,10));

// hex audit
function hexAudit(dir){
  try{
    const out = runSilent(`rg '#[0-9a-fA-F]{3,}' ${dir} -n`);
    if(out.trim()){ console.error('Hex literals found:\n'+out); process.exit(1); }
  }catch{}
}
hexAudit('src/styles/components');
hexAudit('src/styles/utilities');

// duplicate token/theme audit
const tokens=['--p','--pc','--b1','--b2','--b3','--bc'];
for(const t of tokens){
  const count=(css.match(new RegExp(t+':','g'))||[]).length;
  if(count>1){ console.error('Duplicate token '+t); process.exit(1); }
}
const themes=(css.match(/\[data-theme="[^"]+"\]/g)||[]);
const seen=new Set();
for(const th of themes){
  if(seen.has(th)){ console.error('Duplicate theme block '+th); process.exit(1); }
  seen.add(th);
}

// LOC cap
function locCap(dir){
  for(const file of readdirSync(dir)){
    const content = readFileSync(join(dir,file),'utf8');
    const loc = content.split('\n').length;
    if(loc>300 && !content.includes('style-canon-waiver')){
      console.error('LOC threshold exceeded in '+join(dir,file));
      process.exit(1);
    }
  }
}
locCap('src/styles/components');
locCap('src/styles/utilities');

// detection surfaces log
const sourceCss = readFileSync('src/styles/app.tailwind.css','utf8');
const m = sourceCss.match(/@source([^;]+);/);
if(m){
  const cssDir = dirname('src/styles/app.tailwind.css');
  const globs = m[1].trim().split(/\s+/).map(s=>s.replace(/^"|"$/g,''));
  const files = [];
  for(const g of globs){
    const pattern = join(cssDir, g);
    for await (const match of glob(pattern,{nodir:true})){
      files.push(match.replace(/^(\.\.\/)+/,''));
    }
  }
  const outPath = `artifacts/reports/${now}-source-surfaces.txt`;
  writeFileSync(outPath, files.sort().join('\n'));
  console.log('Source surfaces logged to', outPath);
}

console.log('style:canon checks passed');
