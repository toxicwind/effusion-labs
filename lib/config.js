/**
 * Global configuration shared across the build.
 * @module config
 */

/** Eleventy directory settings */
const dirs = {
  input: 'src',
  output: '_site',
  includes: '_includes',
  data: '_data'
};

module.exports = { dirs };
