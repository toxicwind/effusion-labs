function takeLatest(collection, n = 3) {
  return [...(collection || [])]
    .sort((a, b) => b.date - a.date)
    .slice(0, n);
}

module.exports = {
  eleventyComputed: {
    projects: data => takeLatest(data.collections.projects),
    concepts: data => takeLatest(data.collections.concepts),
    sparks: data => takeLatest(data.collections.sparks),
    meta: data => takeLatest(data.collections.meta)
  }
};
