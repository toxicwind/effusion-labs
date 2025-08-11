const fs = require('fs');
const path = require('path');
const { baseContentPath } = require('./constants');

/**
 * Convert a directory name to a human-friendly title.
 * @param {string} name
 * @returns {string}
 */
function titleize(name) {
  return name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/**
 * Build a map of archive navigation entries keyed by their URL.
 * @param {string} dir absolute directory to scan
 * @param {string} url base url for the directory
 * @param {Object} acc accumulator for recursive results
 * @returns {Object} map of url -> nav items
 */
function buildMap(dir, url, acc = {}) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory());

  acc[url] = entries.map((e) => {
    const childUrl = path.posix.join(url, e.name) + '/';
    return { title: titleize(e.name), url: childUrl };
  });

  entries.forEach((e) => {
    const nextDir = path.join(dir, e.name);
    const nextUrl = path.posix.join(url, e.name) + '/';
    buildMap(nextDir, nextUrl, acc);
  });

  return acc;
}

/**
 * Build navigation map for archives based on folder structure.
 * @returns {Object}
 */
function buildArchiveNav() {
  const root = path.join(process.cwd(), baseContentPath, 'archives');
  return buildMap(root, '/archives/');
}

module.exports = { buildArchiveNav };
