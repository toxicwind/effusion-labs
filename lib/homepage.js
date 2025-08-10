const { dailySeed, seededShuffle } = require('./seeded');

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

function getQuestions(arr, { seed, limit = 3 } = {}) {
  return arr && arr.length ? seededShuffle(arr, seed).slice(0, limit) : [];
}

function exploreLinks(collections) {
  return [
    { title: 'Projects', url: '/projects/', count: (collections.projects || []).length },
    { title: 'Concepts', url: '/concepts/', count: (collections.concepts || []).length },
    { title: 'Sparks', url: '/sparks/', count: (collections.sparks || []).length },
    { title: 'Meta', url: '/meta/', count: (collections.meta || []).length },
  ];
}

module.exports = {
  dailySeed,
  seededShuffle,
  getToday,
  getTryNow,
  buildIdeaPathways,
  getQuestions,
  exploreLinks,
  tagNormalize,
  safeUrl,
};
