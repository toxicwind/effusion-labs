// src/lib/shortcodes/index.mjs
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
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

function specnote(variant, content, tooltip) {
  const cls = {
    soft: 'spec-note-soft',
    subtle: 'spec-note-subtle',
    liminal: 'spec-note-liminal',
    archival: 'spec-note-archival',
    ghost: 'spec-note-ghost',
  }[variant] || 'spec-note-soft'
  const safeTooltip = tooltip?.replace(/"/g, '&quot;') || ''
  return `<span class="${cls}" title="${safeTooltip}">${content}</span>`
}

function createCalloutShortcode(eleventyConfig) {
  return function(content, opts = {}) {
    const md = eleventyConfig.markdownLibrary
    const isObj = opts && typeof opts === 'object' && !Array.isArray(opts)
    const {
      title = '',
      kicker = '',
      variant = 'neutral',
      position = 'center',
      icon = '',
      headingLevel = 3,
    } = isObj ? opts : { title: opts }
    const safeTitle = escapeHtml(title)
    const id = `callout-${title ? slug(title) : Date.now()}`
    const body = md.render(String(content), this.ctx ?? {})
    return `<aside class="callout callout--${variant}" role="note" aria-labelledby="${id}">
      <div class="callout-head">
        <h${headingLevel} id="${id}" class="callout-title">
          ${icon ? `<span class=\"callout-icon\">${icon}</span>` : ''}${safeTitle}
        </h${headingLevel}>
        ${kicker ? `<p class=\"callout-kicker\">${escapeHtml(kicker)}</p>` : ''}
      </div>
      <div class="callout-body">${body}</div>
    </aside>`
  }
}

export function registerShortcodes(eleventyConfig) {
  eleventyConfig.addShortcode('specnote', specnote)
  const callout = createCalloutShortcode(eleventyConfig)
  eleventyConfig.addPairedShortcode('callout', callout)
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
