const fs = require('fs');
const postcss = require('postcss');

/**
 * Compile a CSS file using PostCSS with Tailwind and Autoprefixer.
 * @param {string} inputPath - source CSS file
 * @param {string} outputPath - destination path
 */
module.exports = async function runPostcss(inputPath, outputPath) {
  const css = fs.readFileSync(inputPath, 'utf8');
  const result = await postcss([
    require('@tailwindcss/postcss'),
    require('autoprefixer')
  ]).process(css, { from: inputPath });

  fs.mkdirSync(require('path').dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.css);
};
