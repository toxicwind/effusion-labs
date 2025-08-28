import fs from 'node:fs';
import path from 'node:path';

const ARCHIVES_BASE = path.join('src', 'content', 'archives');

const toPosix = (p) => p.replaceAll('\\', '/');
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

function walkJsonl(dirAbs) {
  const out = [];
  if (!exists(dirAbs)) return out;
  for (const ent of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const p = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) out.push(...walkJsonl(p));
    else if (ent.isFile() && p.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function parseParts(absPath) {
  const rel = toPosix(path.relative(ARCHIVES_BASE, absPath));
  const parts = rel.split('/');
  return {
    rel,
    industry: parts.at(0),
    category: parts.at(1),
    company: parts.at(2),
    line: parts.at(3),
    section: parts.at(4), // expected 'provenance'
    file: parts.at(-1),
    base: path.basename(absPath, '.jsonl'),
  };
}

function normalizeSlug(base) {
  // Collapse double dashes used as separators into single for URL aesthetics
  return String(base).replace(/--+/g, '-');
}

export const data = () => {
  return {
    layout: 'layout.njk',
    pagination: { data: 'collections.jsonlProvenance', size: 1, alias: 'entry' },
    eleventyComputed: {
      title: ({ entry }) => `Provenance — ${entry?.base ?? ''}`,
      permalink: ({ entry }) => entry
        ? `/archives/${entry.industry}/${entry.category}/${entry.company}/${entry.line}/provenance/${normalizeSlug(entry.base)}/index.html`
        : false,
      downloadUrl: ({ entry }) => entry
        ? `/archives/${entry.industry}/${entry.category}/${entry.company}/${entry.line}/provenance/${normalizeSlug(entry.base)}.jsonl`
        : '#',
    },
  };
};

export const render = async (data) => {
  if (!data.entry) return '';
  const { codeToHtml } = await import('shiki');
  const code = fs.readFileSync(data.entry.abs, 'utf8');
  const highlighted = await codeToHtml(code, {
    lang: 'jsonl',
    themes: { light: 'github-light', dark: 'github-dark' },
  });
  const downloadHref = data.downloadUrl;
  const filename = `${data.entry.base}.jsonl`;

  return `
  <nav class="breadcrumbs text-sm mb-2 overflow-x-auto whitespace-nowrap" aria-label="Breadcrumb">
    <ul>
      <li><a href="/archives/">Archives</a></li>
      <li><a href="/archives/${data.entry.industry}/">${data.entry.industry}</a></li>
      <li><a href="/archives/${data.entry.industry}/${data.entry.category}/">${data.entry.category}</a></li>
      <li><a href="/archives/${data.entry.industry}/${data.entry.category}/${data.entry.company}/">${data.entry.company}</a></li>
      <li><a href="/archives/${data.entry.industry}/${data.entry.category}/${data.entry.company}/${data.entry.line}/">${data.entry.line}</a></li>
      <li class="opacity-70">Provenance</li>
    </ul>
  </nav>

  <header class="mb-4">
    <h1 class="font-heading text-3xl uppercase tracking-[-0.02em] text-primary mb-1">${data.entry.base}</h1>
    <div class="text-sm opacity-80 space-x-3">
      <a class="link" href="${downloadHref}" download="${filename}">Download</a>
    </div>
  </header>

  <section class="card bg-base-100 border shadow-sm">
    <div class="card-body p-0">
      <div class="overflow-auto" style="max-height: 70vh">
        ${highlighted}
      </div>
    </div>
  </section>
  `;
};
