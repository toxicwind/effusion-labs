// config/site.js
import path from 'node:path';

/** Eleventy directory settings */
export const dirs = {
  input: 'src',
  output: process.env.ELEVENTY_TEST_OUTPUT || '_site',
  includes: '_includes',
  data: '_data',
};

/** Root directory for markdown content */
export const baseContentPath = 'src/content';

/** Absolute path to concepts directory */
export const CONCEPTS_DIR = path.join(baseContentPath, 'concepts');

/** Primary content areas used for collections and navigation */
export const CONTENT_AREAS = ['sparks', 'concepts', 'projects', 'archives', 'meta'];

export default { dirs, baseContentPath, CONCEPTS_DIR, CONTENT_AREAS };

