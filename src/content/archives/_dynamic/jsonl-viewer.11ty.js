import fs from 'node:fs'
import path from 'node:path'

const ARCHIVES_BASE = path.join('src', 'content', 'archives')

const toPosix = p => p.replaceAll('\\', '/')
const exists = p => {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function walkJsonl(dirAbs) {
  const out = []
  if (!exists(dirAbs)) return out
  for (const ent of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const p = path.join(dirAbs, ent.name)
    if (ent.isDirectory()) out.push(...walkJsonl(p))
    else if (ent.isFile() && p.endsWith('.jsonl')) out.push(p)
  }
  return out
}

function parseParts(absPath) {
  const rel = toPosix(path.relative(ARCHIVES_BASE, absPath))
  const parts = rel.split('/')
  return {
    rel,
    industry: parts.at(0),
    category: parts.at(1),
    company: parts.at(2),
    line: parts.at(3),
    section: parts.at(4), // 'provenance'
    file: parts.at(-1),
    base: path.basename(absPath, '.jsonl'),
  }
}

function normalizeSlug(base) {
  return String(base).replace(/--+/g, '-')
}

export const data = () => {
  return {
    layout: 'layouts/base.njk',
    pagination: {
      data: 'collections.jsonlProvenance',
      size: 1,
      alias: 'entry',
    },
    eleventyComputed: {
      title: ({ entry }) => `Provenance — ${entry?.base ?? ''}`,
      permalink: ({ entry }) =>
        entry
          ? `/archives/${entry.industry}/${entry.category}/${entry.company}/${entry.line}/provenance/${normalizeSlug(entry.base)}/index.html`
          : false,
      downloadUrl: ({ entry }) =>
        entry
          ? `/archives/${entry.industry}/${entry.category}/${entry.company}/${entry.line}/provenance/${normalizeSlug(entry.base)}.jsonl`
          : '#',
      showTitle: false,
    },
  }
}

export const render = async data => {
  if (!data.entry) return ''
  const { codeToHtml } = await import('shiki')
  const code = fs.readFileSync(data.entry.abs, 'utf8')
  const highlighted = await codeToHtml(code, {
    lang: 'jsonl',
    themes: { light: 'github-light', dark: 'github-dark' },
  })
  const downloadHref = data.downloadUrl
  const filename = `${data.entry.base}.jsonl`

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

<section class="rounded-box border-2 border-black bg-base-200 p-5 sm:p-7 shadow-[6px_6px_0_rgba(0,0,0,0.85)]">
  <h1 class="m-0 font-extrabold tracking-tight fluid-title">${data.entry.base}</h1>
  <div class="mt-2 text-sm opacity-85 space-x-3">
    <a class="btn btn-outline btn-xs" href="${downloadHref}" download="${filename}">Download</a>
  </div>
</section>

<section class="card bg-base-100 border shadow-sm mt-6">
  <div class="card-body p-0">
    <div class="overflow-auto" style="max-height: 70vh">
      ${highlighted}
    </div>
  </div>
</section>
`.trim()
}
