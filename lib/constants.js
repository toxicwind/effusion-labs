/**
 * Shared site-wide constants.
 * @module constants
 */

const path = require('node:path');

/** Root directory for markdown content */
const baseContentPath = 'src/content';

/** Absolute path to concepts directory */
const CONCEPTS_DIR = path.join(baseContentPath, 'concepts');

/** Primary content areas used for collections and navigation */
const CONTENT_AREAS = ['sparks', 'concepts', 'projects', 'archives', 'meta'];

module.exports = { baseContentPath, CONTENT_AREAS, CONCEPTS_DIR };
