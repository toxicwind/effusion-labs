import { execSync } from 'node:child_process';
import { statSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'glob';

function run(cmd){ execSync(cmd,{stdio:'inherit'}); }

const timestamp = new Date().toISOString().replace(/[:.]/g,'-');

// build CSS
run('postcss src/styles/app.tailwind.css -o src/assets/css/app.css');
const size = statSync('src/assets/css/app.css').size;
console.log('CSS size:', size, 'bytes');

// size budget
const baselineFile = 'scripts/style-size-baseline.json';
let baseline = size;
try { baseline = JSON.parse(readFileSync(baselineFile,'utf8')).size; } catch {}
const limit = Math.round(baseline * 1.15);
if (size > limit) {
  console.error(`CSS size ${size} exceeds budget ${limit}`);
  process.exit(1);
}
const delta = size - baseline;
writeFileSync(baselineFile, JSON.stringify({ size }, null, 2));
console.log('Size delta:', delta);

// top selectors by line count
const css = readFileSync('src/assets/css/app.css','utf8');
const blocks = css.split('}').map(b=>({sel:b.split('{')[0].trim(), lines:b.split('\n').length}));
blocks.sort((a,b)=>b.lines-a.lines);
console.log('Top selectors by lines:');
blocks.slice(0,10).forEach(b=>console.log(`${b.lines}\t${b.sel}`));

// hex audit
function hexAudit(dir){
  try {
    const hex = execSync(`rg '#[0-9a-fA-F]{3,6}' ${dir} -n`).toString();
    if (hex.trim()) { console.error('Hex literals found\n'+hex); process.exit(1); }
  } catch {}
}
hexAudit('src/styles/components');
hexAudit('src/styles/utilities');

// duplicate token/theme audit
const tokenRegex = /--(p|pc|b1|b2|b3|n)\s*:/g;
const seenTokens = {};
let m;
while((m=tokenRegex.exec(css))) seenTokens[m[1]] = (seenTokens[m[1]]||0)+1;
for (const [tok,count] of Object.entries(seenTokens)) {
  if (count > 2) { console.error('Duplicate token', tok); process.exit(1); }
}
const themeRegex = /\[data-theme="([^"]+)"\]/g;
const seenThemes = {};
while((m=themeRegex.exec(css))) seenThemes[m[1]] = (seenThemes[m[1]]||0)+1;
for (const [name,count] of Object.entries(seenThemes)) {
  if (count > 1) { console.error('Duplicate theme block', name); process.exit(1); }
}

// module LOC cap
function locCap(dir){
  for (const file of readdirSync(dir)) {
    const loc = readFileSync(join(dir,file),'utf8').split('\n').length;
    if (loc > 300) {
      const content = readFileSync(join(dir,file),'utf8');
      if (!content.includes('/* waiver:')) {
        console.error('LOC threshold exceeded in', file);
        process.exit(1);
      }
    }
  }
}
locCap('src/styles/components');
locCap('src/styles/utilities');

// detection log
const includes = [
  'src/_includes/**/*.njk',
  'src/content/**/*.njk',
  'src/**/*.js',
  'src/**/*.mjs'
];
const excludes = [
  '**/*.ipynb',
  'docs/vendor/**',
  'artifacts/**',
  'dist/**',
  'build/**',
  'coverage/**',
  'node_modules/**',
  '**/*.{png,jpg,jpeg,svg,webp,mp4,mp3}',
  'demos/**',
  'fixtures/**'
];
const sources = globSync(includes, { ignore: excludes }).sort();
writeFileSync(`artifacts/reports/${timestamp}-source-surfaces.txt`, sources.join('\n'));

console.log('style:canon checks passed');
