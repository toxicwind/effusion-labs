export const data = () => ({
  layout: 'layout.njk',
  pagination: { data: 'collections.jsonlDirs', size: 1, alias: 'dir' },
  eleventyComputed: {
    title: ({ dir }) => `Provenance — ${dir?.rel ?? ''}`,
    permalink: ({ dir }) => dir ? `/archives/${dir.rel}/provenance/index.html` : false,
  },
});

export const render = ({ dir }) => {
  if (!dir) return '';
  const items = dir.items || [];
  const list = items.map(it => `
    <li class="flex items-center justify-between gap-4">
      <div class="truncate font-mono text-sm">${it.base}.jsonl</div>
      <div class="shrink-0 space-x-3 text-sm">
        <a class="link" href="/archives/${it.industry}/${it.category}/${it.company}/${it.line}/provenance/${it.slug}/">View</a>
        <a class="link" href="${it.rawUrl}">Raw</a>
        <a class="link" href="${it.rawUrl}?download=1">Download</a>
      </div>
    </li>`).join('\n');

  return `
  <header class="mb-4">
    <h1 class="font-heading text-3xl uppercase tracking-[-0.02em] text-primary mb-1">Provenance Files</h1>
    <p class="opacity-70 text-sm">${dir.rel}</p>
  </header>
  <section class="card bg-base-100 border shadow-sm">
    <div class="card-body p-4 sm:p-6">
      <ul class="divide-y">${list}</ul>
    </div>
  </section>
  `;
};
