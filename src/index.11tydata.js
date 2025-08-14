module.exports = (data = {}) => {
  const collections = data.collections || {};
  const pick = (arr = []) => arr.slice(0, 3);
  return {
    projects: pick(collections.projects),
    concepts: pick(collections.concepts),
    sparks: pick(collections.sparks),
    meta: pick(collections.meta),
  };
};
