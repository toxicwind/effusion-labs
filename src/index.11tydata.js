const {
  dailySeed,
  getToday,
  getTryNow,
  buildIdeaPathways,
  getQuestions,
  exploreLinks,
} = require('../lib/homepage');
const questions = require('./_data/questions.json');

module.exports = (data = {}) => {
  const seed = dailySeed();
  const collections = data.collections || {};
  const caps = data.homepageCaps || { featured: 3, today: 3, pathways: 3, questions: 3, notebook: 4 };
  const recentAll = collections.recentAll || [];

  const featured = (collections.featured || []).slice(0, caps.featured || 3);
  const today = getToday(recentAll, { seed, limit: caps.today });
  const tryNow = getTryNow(collections.interactive || [], { limit: caps.tryNow ? caps.tryNow[1] : 3 });
  const ideaPathways = buildIdeaPathways(collections, { seed, limit: caps.pathways });
  const openQuestions = getQuestions(questions, { seed, limit: caps.questions });
  const notebook = recentAll.take ? recentAll.take(caps.notebook) : recentAll.slice(0, caps.notebook);
  const explore = exploreLinks(collections);

  return { featured, today, tryNow, ideaPathways, openQuestions, notebook, explore };
};
