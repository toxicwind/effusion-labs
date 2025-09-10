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
export function specnote(variant, content, tooltip) {
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

export default { specnote };
