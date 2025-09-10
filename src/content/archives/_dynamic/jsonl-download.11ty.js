import fs from 'node:fs';
import path from 'node:path';

const ARCHIVES_BASE = path.join('src', 'content', 'archives');

const toPosix = (p) => p.replaceAll('\\', '/');

function parseParts(absPath) {
  const rel = toPosix(path.relative(ARCHIVES_BASE, absPath));
  const parts = rel.split('/');
  return {
    rel,
    industry: parts[0],
    category: parts[1],
    company: parts[2],
    line: parts[3],
    base: path.basename(absPath, '.jsonl'),
  };
}

export const data = () => ({
  eleventyExcludeFromCollections: true,
  pagination: { data: 'collections.jsonlProvenance', size: 1, alias: 'entry' },
  eleventyComputed: {
    permalink: ({ entry }) => entry
      ? `/archives/${entry.industry}/${entry.category}/${entry.company}/${entry.line}/provenance/${entry.slug}.jsonl`
      : false,
  },
});

export const render = ({ entry }) => {
  if (!entry) return '';
  return fs.readFileSync(entry.abs, 'utf8');
};

