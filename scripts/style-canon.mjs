import { execSync } from 'node:child_process';
import { statSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function run(cmd){ execSync(cmd,{stdio:'inherit'}); }

// build CSS
run('postcss src/styles/app.tailwind.css -o src/assets/css/app.css');
const size = statSync('src/assets/css/app.css').size;
console.log('CSS size:', size, 'bytes');

// hex audit
try {
  const hex = execSync("rg '#[0-9a-fA-F]{3,}' src/styles/components -n").toString();
  if (hex.trim()) {
    console.error('Hex literals found:\n'+hex);
    process.exit(1);
  }
} catch (e) {
  // rg exits 1 when no matches; that's success
}

// LOC threshold
const cmpDir = 'src/styles/components';
for (const file of readdirSync(cmpDir)) {
  const loc = readFileSync(join(cmpDir,file),'utf8').split('\n').length;
  if (loc > 300) {
    console.error('LOC threshold exceeded in', file);
    process.exit(1);
  }
}

console.log('style:canon checks passed');
