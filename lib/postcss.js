const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const loadPostcssPlugins = require('./postcssPlugins');

/**
 * Compile a CSS file using PostCSS with plugins from the project config.
 * Skips processing when the destination is newer than the source.
 *
 * @param {string} inputPath  source CSS file
 * @param {string} outputPath destination path
 * @returns {Promise<void>}
 */
module.exports = async function runPostcss(inputPath, outputPath) {
  const inputStat = fs.statSync(inputPath);
  const outStat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
  if (outStat && outStat.mtimeMs >= inputStat.mtimeMs) {
    return; // up to date
  }

  const css = fs.readFileSync(inputPath, 'utf8');
  const plugins = loadPostcssPlugins();
  const result = await postcss(plugins).process(css, {
    from: inputPath,
    to: outputPath,
    map: { inline: true }
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.css);
};
