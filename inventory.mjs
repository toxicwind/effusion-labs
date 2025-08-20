import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const root = process.cwd();
const entries = [];
const cssExt = new Set(['.css', '.pcss', '.scss', '.sass']);
const jsExt = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx']);
const templateExt = new Set([
  '.njk',
  '.html',
  '.md',
  '.mdx',
  '.11ty.js',
  '.11ty.cjs',
  '.11ty.mjs',
]);
const configFiles = [
  'tailwind.config.js',
  'tailwind.config.mjs',
  'postcss.config.js',
  'postcss.config.mjs',
  'eleventy.config.mjs',
];

async function walk(dir) {
  const list = await fs.readdir(dir, { withFileTypes: true });
  for (const dirent of list) {
    if (
      dirent.name === 'node_modules' ||
      dirent.name.startsWith('.git') ||
      dirent.name === '_site' ||
      dirent.name === 'docs' ||
      dirent.name === 'test'
    )
      continue;
    if (
      dirent.name.startsWith('ARACA_REPORT') ||
      dirent.name === 'AGENTS.md' ||
      dirent.name.startsWith('inventory')
    )
      continue;
    const res = path.join(dir, dirent.name);
    if (dirent.isDirectory()) await walk(res);
    else {
      const ext = path.extname(dirent.name);
      const rel = path.relative(root, res);
      let type = null;
      if (cssExt.has(ext)) type = 'css';
      else if (jsExt.has(ext)) type = 'js';
      else if (templateExt.has(ext) || dirent.name.endsWith('.11ty.js'))
        type = 'template';
      if (configFiles.includes(dirent.name)) type = 'config';
      if (!type) continue;
      const stat = await fs.stat(res);
      const buf = await fs.readFile(res);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      let importers = [];
      try {
        const rg = execSync(
          `rg -l ${JSON.stringify(path.basename(dirent.name))} || true`,
          { encoding: 'utf8' },
        );
        importers = rg
          .split('\n')
          .filter(Boolean)
          .filter((p) => p !== rel);
      } catch {}
      entries.push({ path: rel, size: stat.size, hash, type, importers });
    }
  }
}

await walk(root);
await fs.mkdir('docs/reports', { recursive: true });
await fs.writeFile(
  'docs/reports/assets-inventory.json',
  JSON.stringify(entries, null, 2),
);
