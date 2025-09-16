export const data = () => ({
  layout: 'base.njk',
  pagination: { data: 'collections.jsonlDirs', size: 1, alias: 'dir' },
  eleventyComputed: {
    title: ({ dir }) => `Provenance — ${dir?.rel ?? ''}`,
    permalink: ({ dir }) =>
      dir ? `/archives/${dir.rel}/provenance/index.html` : false,
    showTitle: false,
  },
})

export const render = ({ dir }) => {
  if (!dir) return ''
  const items = dir.items || []
  const list = items
    .map(
      it => `
      <li class="flex items-center justify-between gap-4">
        <div class="truncate font-mono text-sm">${it.base}.jsonl</div>
        <div class="shrink-0 space-x-3 text-sm">
          <a class="link" href="/archives/${it.industry}/${it.category}/${it.company}/${it.line}/provenance/${it.slug}/">View</a>
          <a class="link" href="${it.rawUrl}">Raw</a>
          <a class="link" href="${it.rawUrl}?download=1">Download</a>
        </div>
      </li>`
    )
    .join('\n')

  return `
<nav class="breadcrumbs text-sm mb-2 overflow-x-auto whitespace-nowrap" aria-label="Breadcrumb">
  <ul>
    <li><a href="/archives/">Archives</a></li>
    <li class="opacity-70">Provenance</li>
  </ul>
</nav>

<section class="rounded-box border-2 border-black bg-base-200 p-5 sm:p-7 shadow-[6px_6px_0_rgba(0,0,0,0.85)]">
  <h1 class="m-0 font-extrabold tracking-tight fluid-title">Provenance Files</h1>
  <p class="opacity-75 mt-1">${dir.rel}</p>
</section>

<section class="card bg-base-100 border shadow-sm mt-6">
  <div class="card-body p-4 sm:p-6">
    <ul class="divide-y">${list}</ul>
  </div>
</section>
`.trim()
}
