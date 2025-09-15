// config/markdown/index.js
import markdownItFootnote from 'markdown-it-footnote'
import { hybridFootnotes, footnotePopoverRefs } from './footnotes.js'
import { audioEmbed, qrEmbed } from './inlineMacros.js'
import { externalLinks } from './links.js'

/**
 * Apply markdown-it extensions.
 * Keep this compact and resilient; failures should not tank the build.
 */
export function applyMarkdownExtensions(md) {
  // Core footnotes
  md.use(markdownItFootnote)

  // Aesthetic & UX layers
  try {
    hybridFootnotes(md)
  } catch (e) {
    console.error('[md-it] hybridFootnotes:', e?.message || e)
  }
  try {
    footnotePopoverRefs(md)
  } catch (e) {
    console.error('[md-it] footnotePopoverRefs:', e?.message || e)
  }

  // Inline macros
  try {
    audioEmbed(md)
  } catch (e) {
    console.error('[md-it] audioEmbed:', e?.message || e)
  }
  try {
    qrEmbed(md)
  } catch (e) {
    console.error('[md-it] qrEmbed:', e?.message || e)
  }

  // External links
  try {
    externalLinks(md)
  } catch (e) {
    console.error('[md-it] externalLinks:', e?.message || e)
  }

  return md
}

export default { applyMarkdownExtensions }
