/**
 * Shared site-wide constants.
 * @module constants
 */

import path from 'node:path';

/** Root directory for markdown content */
export const baseContentPath = 'src/content';

/** Absolute path to concepts directory */
export const CONCEPTS_DIR = path.join(baseContentPath, 'concepts');

/** Primary content areas used for collections and navigation */
export const CONTENT_AREAS = ['sparks', 'concepts', 'projects', 'archives', 'meta'];
export default { baseContentPath, CONTENT_AREAS, CONCEPTS_DIR };
