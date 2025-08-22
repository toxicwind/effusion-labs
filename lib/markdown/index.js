// lib/markdown/index.js
import {
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  connectFootnoteBlockquotes,
  disableFootnoteTail,
} from "./footnotes.js";
import { audioEmbed, qrEmbed } from "./inlineMacros.js";
import { externalLinks } from "./links.js";

/**
 * Array of markdown-it extension functions to apply.
 * NOTE: anchors are configured in eleventy.config.mjs, so not added here.
 */
const mdItExtensions = [
  // anchors, // <-- remove this reference
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  connectFootnoteBlockquotes,
  disableFootnoteTail,
  audioEmbed,
  qrEmbed,
  externalLinks,
];

export function applyMarkdownExtensions(md) {
  mdItExtensions.forEach((fn) => {
    try { fn(md); } catch (err) {
      console.error(`[md-it] Failed extension: ${err?.message || err}`);
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
