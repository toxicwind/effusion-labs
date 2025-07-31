const { hybridFootnoteDefinitions, footnotePopover, collectFootnoteTokens, disableFootnoteTail } = require('./footnotes');
const { audioEmbed, qrEmbed } = require('./inlineMacros');
const { externalLinks } = require('./links');

/** Array of markdown-it extension functions to apply */
const mdItExtensions = [
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  disableFootnoteTail,
  audioEmbed,
  qrEmbed,
  externalLinks
];

module.exports = {
  hybridFootnoteDefinitions,
  footnotePopover,
  collectFootnoteTokens,
  disableFootnoteTail,
  audioEmbed,
  qrEmbed,
  externalLinks,
  mdItExtensions
};
