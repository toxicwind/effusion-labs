/**
 * Global configuration shared across the build.
 * @module config
 */

/** Eleventy directory settings */
export const dirs = {
  input: 'src',
  output: process.env.ELEVENTY_TEST_OUTPUT || '_site',
  includes: '_includes',
  data: '_data',
};

export default { dirs };
