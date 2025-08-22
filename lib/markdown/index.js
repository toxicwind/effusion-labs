import {
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  connectFootnoteBlockquotes,
  disableFootnoteTail,
} from './footnotes.js';
import { audioEmbed, qrEmbed } from './inlineMacros.js';
import { externalLinks } from './links.js';

/** Array of markdown-it extension functions to apply */
const mdItExtensions = [
  anchors,
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  connectFootnoteBlockquotes,
  disableFootnoteTail,
  audioEmbed,
  qrEmbed,
  externalLinks
];

/**
 * Apply all markdown-it extensions to the given instance.
 * @param {import('markdown-it')} md - markdown-it instance
 */
export function applyMarkdownExtensions(md) {
  mdItExtensions.forEach(fn => {
    try {
      fn(md);
    } catch (error) {
      console.error(`Error applying markdown extension: ${error.message}`);
    }
  });
  return md;
}

export {
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  connectFootnoteBlockquotes,
  disableFootnoteTail,
  audioEmbed,
  qrEmbed,
  externalLinks,
  mdItExtensions,
};

export default {
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  connectFootnoteBlockquotes,
  disableFootnoteTail,
  audioEmbed,
  qrEmbed,
  externalLinks,
  mdItExtensions,
  applyMarkdownExtensions,
};
