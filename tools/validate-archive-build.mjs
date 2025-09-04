import fs from 'node:fs';
import path from 'node:path';
import { slugCanonicalProduct } from '../lib/naming-canon.mjs';

// Tiny slugifier mirroring lib/eleventy/archives.mjs
export function slugify(input) {
  return String(input ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'item';
}

function walkJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkJson(p));
    else if (ent.isFile() && p.endsWith('.json')) out.push(p);
  }
  return out;
}

export function collectArchivePages(baseDir) {
  const files = walkJson(baseDir);
  return files.flatMap((abs) => {
    const parts = path.relative(baseDir, abs).split(path.sep);
    if (parts.includes('i18n') || parts.length < 6) return [];
    const [industry, category, company, line, section] = parts;
    if (!['products', 'characters', 'series'].includes(section)) return [];
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const fileSlug = path.basename(abs, '.json');
    let url;
    if (section === 'products') {
      const slug = slugCanonicalProduct(raw);
      if (!slug || slug === 'item') return null;
      url = `/archives/product/${slug}/`;
    } else if (section === 'characters') {
      const slug = slugify(raw.slug ?? raw.name ?? fileSlug);
      url = `/archives/character/${slug}/`;
    } else if (section === 'series') {
      const slug = slugify(raw.slug ?? raw.title ?? fileSlug);
      url = `/archives/series/${slug}/`;
    }
    return url ? { url, abs } : null;
  }).filter(Boolean);
}

export function validateArchiveBuild({ base = 'src/content/archives', outDir = '_site' } = {}) {
  const baseAbs = path.resolve(base);
  const outAbs = path.resolve(outDir);
  const entries = collectArchivePages(baseAbs);
  const missing = entries.filter((e) => !fs.existsSync(path.join(outAbs, e.url, 'index.html')));
  if (missing.length) {
    console.error('Missing archive pages:\n' + missing.map(m => m.url).join('\n'));
    process.exit(1);
  }
  console.log(`✅ archive build OK: ${entries.length} pages present`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateArchiveBuild();
}
