/**
 * Shortcodes for Eleventy templates.
 * @module shortcodes
 */

/**
 * Render an inline specification note span.
 *
 * @param {string} variant - Style variant name
 * @param {string} content - Inner HTML content
 * @param {string} [tooltip] - Optional tooltip text
 * @returns {string} HTML string
 */
function specnote(variant, content, tooltip) {
  const cls = {
    soft: 'spec-note-soft',
    subtle: 'spec-note-subtle',
    liminal: 'spec-note-liminal',
    archival: 'spec-note-archival',
    ghost: 'spec-note-ghost'
  }[variant] || 'spec-note-soft';

  const safeTooltip = tooltip?.replace(/"/g, '&quot;') || '';
  return `<span class="${cls}" title="${safeTooltip}">${content}</span>`;
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slug(s = '') {
  return String(s)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\s\w-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function callout(content, opts = {}) {
  const isObj = opts && typeof opts === 'object' && !Array.isArray(opts);
  const {
    title = '',
    kicker = '',
    variant = 'neutral',
    icon = '',
    headingLevel = 3,
  } = isObj ? opts : { title: opts };

  const safeTitle = escapeHtml(title);
  const id = `callout-${title ? slug(title) : Date.now()}`;
  const body = String(content ?? '');

  return `<aside class="callout callout--${variant}" role="note" aria-labelledby="${id}">
    <div class="callout-head">
      <h${headingLevel} id="${id}" class="callout-title">
        ${icon ? `<span class="callout-icon">${icon}</span>` : ''}${safeTitle}
      </h${headingLevel}>
      ${kicker ? `<p class="callout-kicker">${escapeHtml(kicker)}</p>` : ''}
    </div>
    <div class="callout-body">${body}</div>
  </aside>`;
}

function failbox(content, titleOrOpts, kicker) {
  const opts = titleOrOpts && typeof titleOrOpts === 'object'
    ? { ...titleOrOpts, variant: 'error' }
    : { title: titleOrOpts, kicker, variant: 'error' };
  return callout(content, opts);
}

module.exports = { specnote, callout, failbox };
