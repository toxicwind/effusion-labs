const { hybridFootnoteDefinitions, footnotePopover, collectFootnoteTokens, connectFootnoteBlockquotes, disableFootnoteTail } = require('./footnotes');
const { audioEmbed, qrEmbed } = require('./inlineMacros');
const { externalLinks } = require('./links');

/** Array of markdown-it extension functions to apply */
const mdItExtensions = [
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
function applyMarkdownExtensions(md) {
  mdItExtensions.forEach(fn => {
    try {
      fn(md);
    } catch (error) {
      console.error(`Error applying markdown extension: ${error.message}`);
    }
  });
  return md;
}

module.exports = {
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  connectFootnoteBlockquotes,
  disableFootnoteTail,
  audioEmbed,
  qrEmbed,
  externalLinks,
  mdItExtensions,
  applyMarkdownExtensions
};
