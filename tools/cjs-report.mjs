import fs from 'node:fs';

function pathsFromScan(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  const paths = new Set();
  for (const line of lines) {
    const evt = JSON.parse(line);
    if (evt.type === 'match') paths.add(evt.data.path.text);
  }
  return paths;
}

const include = /^(lib|src|scripts|tools|test|tailwind\.config\.cjs|postcss\.config\.cjs)/;
const before = [...pathsFromScan('tmp/cjs-scan.json')].filter(p => include.test(p));
const after = new Set([...pathsFromScan('tmp/cjs-scan-post.json')].filter(p => include.test(p)));
const report = [];
for (const p of before) {
  let status;
  if (!after.has(p)) status = 'Converted or Removed';
  else if (p.endsWith('.cjs')) status = 'Kept as .cjs (compat)';
  else status = 'Unresolved';
  report.push({ file: p, status });
}
fs.writeFileSync('cjs-report.json', JSON.stringify(report, null, 2));
let md = '# CJS Discovery Report\n\n';
for (const r of report) md += `- ${r.file}: ${r.status}\n`;
fs.writeFileSync('cjs-report.md', md);
