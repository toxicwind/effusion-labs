const { dailySeed, seededShuffle } = require('./seeded');
const fs = require('node:fs');
const path = require('node:path');
const { baseContentPath } = require('./constants');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function recencyScore(date, now = Date.now()) {
  const ageDays = (now - date) / MS_PER_DAY;
  return Math.pow(0.5, ageDays / 30);
}

function selectToday(items, seed) {
  const scored = items.map((item) => {
    const base = recencyScore(item.date) * (item.data.featured ? 1.5 : 1);
    return { item, base };
  });
  const shuffled = seededShuffle(scored, seed);
  shuffled.sort((a, b) => b.base - a.base);
  const selected = [];
  const used = new Set();
  for (const s of shuffled) {
    if (selected.length >= 3) break;
    const type = s.item.data.type;
    if (!used.has(type) || used.size >= 2) {
      selected.push(s.item);
      used.add(type);
    }
  }
  return selected;
}

function getToday(items, { seed, limit = 3 } = {}) {
  return selectToday(items, seed).slice(0, limit);
}

function getTryNow(items, { limit = 3 } = {}) {
  return items.slice(0, limit);
}

function tagNormalize(tags = []) {
  return tags.map((t) => String(t).toLowerCase());
}

function safeUrl(item) {
  return item && item.url ? item.url : '#';
}

function countEntries(coll, folder) {
  if (Array.isArray(coll)) {
    return coll.filter((p) => {
      const stem = p.filePathStem || '';
      return stem !== 'index' && !stem.endsWith('/index');
    }).length;
  }
  try {
    const dir = path.join(baseContentPath, folder);
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'index.md').length;
  } catch {
    return 0;
  }
}

function buildIdeaPathways(collections, { seed, limit = 3 } = {}) {
  const concepts = collections.concepts || [];
  const projects = collections.projects || [];
  const sparks = collections.sparks || [];
  const start = seededShuffle(concepts, seed).slice(0, limit);
  return start.map((concept) => {
    const ctags = tagNormalize(concept.data.tags || []);
    const project =
      projects.find((p) =>
        tagNormalize(p.data.tags || []).some((t) => ctags.includes(t))
      ) || projects[0];
    const spark =
      sparks.find((s) => {
        const stags = tagNormalize(s.data.tags || []);
        return (
          (project &&
            tagNormalize(project.data.tags || []).some((t) => stags.includes(t))) ||
          stags.some((t) => ctags.includes(t))
        );
      }) || sparks[0];
    return [concept, project, spark]
      .filter(Boolean)
      .map((n) => ({ title: n.data.title, url: safeUrl(n) }));
  });
}

function exploreLinks(collections) {
  const defs = [
    { title: 'Projects', url: '/projects/', key: 'projects' },
    { title: 'Concepts', url: '/concepts/', key: 'concepts' },
    { title: 'Sparks', url: '/sparks/', key: 'sparks' },
    { title: 'Meta', url: '/meta/', key: 'meta' },
  ];
  return defs.map(({ title, url, key }) => ({
    title,
    url,
    count: countEntries(collections[key], key),
  }));
}

module.exports = {
  dailySeed,
  seededShuffle,
  getToday,
  getTryNow,
  buildIdeaPathways,
  exploreLinks,
  tagNormalize,
  safeUrl,
  countEntries,
};
