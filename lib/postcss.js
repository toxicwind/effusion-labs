const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const loadPostcssPlugins = require('./postcssPlugins');

const POISON_MARKER = '@import "tailwindcss"';

/**
 * Every file that feeds the compiled stylesheet: the entry, all style
 * partials, the tailwind config, and the postcss wiring itself.
 */
function inputFiles(entryPath) {
  const files = [entryPath, 'tailwind.config.mjs', 'lib/postcss.js', 'lib/postcssPlugins.js'];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.css')) files.push(p);
    }
  };
  if (fs.existsSync('src/styles')) walk('src/styles');
  return [...new Set(files)].filter((f) => fs.existsSync(f));
}

function newestInputMtime(files) {
  let m = 0;
  for (const f of files) {
    const t = fs.statSync(f).mtimeMs;
    if (t > m) m = t;
  }
  return m;
}

/**
 * Compile a CSS file using PostCSS with plugins from the project config.
 * Skips only when the destination is newer than EVERY input. Also
 * self-heals: if the destination still contains a raw `@import "tailwindcss"`
 * (the old passthrough-clobber poison), it always recompiles.
 *
 * @param {string} inputPath  source CSS file
 * @param {string} outputPath destination path
 * @returns {Promise<void>}
 */
module.exports = async function runPostcss(inputPath, outputPath) {
  const inputs = inputFiles(inputPath);
  if (fs.existsSync(outputPath)) {
    const dest = fs.readFileSync(outputPath, 'utf8');
    const poisoned = dest.includes(POISON_MARKER);
    const outStat = fs.statSync(outputPath);
    if (!poisoned && outStat.mtimeMs >= newestInputMtime(inputs)) {
      return; // up to date
    }
    if (poisoned) console.log('[postcss] stale raw-@import poison detected, forcing recompile');
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
