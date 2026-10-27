// src/utils/shortcodes/index.mjs
const escapeHtml = str =>
  String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const slug = s =>
  String(s ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\s\w-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

function createCalloutShortcode(eleventyConfig) {
  return function(content, opts = {}) {
    const md = eleventyConfig.markdownLibrary
    const isObj = opts && typeof opts === 'object' && !Array.isArray(opts)
    const {
      title = '',
      kicker = '',
      variant = 'info', // info, success, warning, error, primary
      icon = '',
      headingLevel = 3,
    } = isObj ? opts : { title: opts }

    const safeTitle = escapeHtml(title)
    const id = `callout-${title ? slug(title) : Date.now()}`
    const body = md.render(String(content), this.ctx ?? {})

    // Advanced Layout: Fluid Stack + DaisyUI 5 Alerts
    return `<aside class="alert alert-${variant} hb-shadow-brut p-space-m flex-col items-start stack" style="--space: var(--space-xs)" role="note" aria-labelledby="${id}">
      <div class="cluster" style="--space: var(--space-xs)">
        ${icon ? `<span class="w-6 h-6">${icon}</span>` : ''}
        <div class="stack" style="--space: 0">
           ${
      kicker
        ? `<span class="text-[0.6rem] uppercase tracking-widest font-mono opacity-60">${
          escapeHtml(kicker)
        }</span>`
        : ''
    }
           <h${headingLevel} id="${id}" class="text-lg font-black tracking-tight leading-none">${safeTitle}</h${headingLevel}>
        </div>
      </div>
      <div class="prose prose-sm opacity-90 stack" style="--space: var(--space-s)">${body}</div>
    </aside>`
  }
}

function neonBox(content, title = 'Attention') {
  return `<div class="hb-neon p-[1px] rounded-lg hb-shadow-brut overflow-hidden my-space-l">
     <div class="bg-base-100 p-space-m rounded-[calc(var(--radius)-1px)] stack" style="--space: var(--space-xs)">
       <span class="text-[0.6rem] uppercase tracking-widest font-black text-primary">${
    escapeHtml(title)
  }</span>
       <div class="text-base">${content}</div>
     </div>
   </div>`
}

export function registerShortcodes(eleventyConfig) {
  const callout = createCalloutShortcode(eleventyConfig)
  eleventyConfig.addPairedShortcode('callout', callout)
  eleventyConfig.addPairedShortcode('neonBox', neonBox)

  eleventyConfig.addPairedShortcode(
    'failbox',
    function(content, titleOrOpts, kicker) {
      const opts = titleOrOpts && typeof titleOrOpts === 'object'
        ? { ...titleOrOpts, variant: 'error' }
        : { title: titleOrOpts, kicker, variant: 'error' }
      return callout.call(this, content, opts)
    },
  )
}

export default { registerShortcodes }
