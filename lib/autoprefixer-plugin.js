const fs = require('fs');
const path = require('node:path');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

module.exports = function autoprefixerPlugin(options = {}) {
  const cssPath = options.cssPath || 'assets/main.css';

  return (eleventyConfig) => {
    eleventyConfig.on('eleventy.after', async () => {
      const outPath = path.join(eleventyConfig.dir.output, cssPath);
      if (!fs.existsSync(outPath)) return;
      const css = await fs.promises.readFile(outPath, 'utf8');
      const result = await postcss([autoprefixer]).process(css, { from: outPath });
      await fs.promises.writeFile(outPath, result.css);
    });
  };
};
