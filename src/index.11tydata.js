const { dailySeed, seededShuffle, selectToday, tagNormalize, safeUrl } = require('../lib/homepage');
const questions = require('./_data/questions.json');

function buildIdeaPathways(collections, seed) {
  const concepts = collections.concepts || [];
  const projects = collections.projects || [];
  const sparks = collections.sparks || [];
  const start = seededShuffle(concepts, seed).slice(0, 3);
  return start.map(concept => {
    const ctags = tagNormalize(concept.data.tags || []);
    const project = projects.find(p => tagNormalize(p.data.tags || []).some(t => ctags.includes(t))) || projects[0];
    const spark = sparks.find(s => {
      const stags = tagNormalize(s.data.tags || []);
      return (project && tagNormalize(project.data.tags || []).some(t => stags.includes(t))) || stags.some(t => ctags.includes(t));
    }) || sparks[0];
    return [concept, project, spark]
      .filter(Boolean)
      .map(n => ({ title: n.data.title, url: safeUrl(n) }));
  });
}

module.exports = data => {
  const seed = dailySeed();
  const collections = data.collections || {};
  const recentAll = collections.recentAll || [];
  const todayAtLab = selectToday(recentAll, seed);
  const tryItNow = seededShuffle(collections.interactive || [], seed).slice(0, 3);
  const ideaPathways = buildIdeaPathways(collections, seed);
  const openQuestions = seededShuffle(questions, seed).slice(0, 3);
  const recentNotebook = recentAll.take ? recentAll.take(4) : recentAll.slice(0, 4);
  const counts = {
    projects: (collections.projects || []).length,
    concepts: (collections.concepts || []).length,
    sparks: (collections.sparks || []).length,
    meta: (collections.meta || []).length
  };
  return {
    todayAtLab,
    tryItNow,
    ideaPathways,
    openQuestions,
    recentNotebook,
    counts
  };
};
