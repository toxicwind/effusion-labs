// config/markdown/footnotes.js
// Cleaner footnotes with inline popovers and nice cards.
// Keeps defaults from markdown-it-footnote but overrides rendering to be
// more “hyperbrut” and accessible.

/**
 * Render the footnote block using chunky “cards”.
 * Keeps the footnotes where the library would normally place them, but
 * you’ll mostly rely on popovers inline (see footnotePopoverRefs).
 */
export function hybridFootnotes(md) {
  md.renderer.rules.footnote_block_open = () =>
    '<section class="footnotes-hybrid not-prose mt-8">\n'
  md.renderer.rules.footnote_block_close = () => '</section>\n'

  md.renderer.rules.footnote_open = (tokens, idx, options, env, slf) => {
    const id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf)
    return `<aside class="footnote-aside card bg-base-100 border-2 shadow-[6px_6px_0_rgba(0,0,0,.85)] my-3" role="note" id="fn${id}"><div class="card-body p-4 text-sm">`
  }
  md.renderer.rules.footnote_close = () => `</div></aside>\n`

  md.renderer.rules.footnote_anchor = (tokens, idx, options, env, slf) => {
    const id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf)
    return `<a href="#fnref${id}" class="footnote-backref link text-xs opacity-70 ml-2">↩︎</a>`
  }
}

/**
 * Replace footnote reference markers with inline popover balloons.
 * Falls back to default ref if anything goes sideways.
 */
export function footnotePopoverRefs(md) {
  const base =
    md.renderer.rules.footnote_ref ||
    ((t, i, o, e, s) => s.renderToken(t, i, o))

  md.renderer.rules.footnote_ref = (tokens, idx, options, env, self) => {
    try {
      const meta = tokens[idx].meta || {}
      const id = Number(meta.id)
      const list = env.footnotes?.list
      if (!Array.isArray(list) || !list[id])
        return base(tokens, idx, options, env, self)

      // Render the footnote definition content as HTML
      let contentHtml = ''
      const def = list[id]
      if (Array.isArray(def.tokens)) {
        const tempEnv = { ...env }
        contentHtml = md.renderer.render(def.tokens, options, tempEnv).trim()
      } else if (def.content) {
        contentHtml = md.renderInline(def.content).trim()
      }

      // Light cleanup for inline use
      contentHtml = contentHtml
        .replace(/<\/?p[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      const n = id + 1
      const refId = `fnref${n}`
      const defId = `fn${n}`

      return (
        `<sup class="fn-pop annotation-ref align-super">` +
        `<a href="#${defId}" id="${refId}" class="annotation-anchor">[${n}]</a>` +
        `<span class="fn-balloon rounded-box">${contentHtml}</span>` +
        `</sup>`
      )
    } catch {
      return base(tokens, idx, options, env, self)
    }
  }
}

export default { hybridFootnotes, footnotePopoverRefs }
