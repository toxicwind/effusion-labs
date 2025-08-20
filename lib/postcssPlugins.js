/**
 * Load PostCSS plugins defined in `postcss.config.cjs`.
 * @returns {Array<import('postcss').Plugin>}
 */
function loadPostcssPlugins() {
  const config = require('../postcss.config.cjs');
  const plugins = config.plugins || [];
  if (Array.isArray(plugins)) {
    return plugins;
  }
  return Object.entries(plugins).map(([name, opts]) => require(name)(opts));
}

module.exports = loadPostcssPlugins;
