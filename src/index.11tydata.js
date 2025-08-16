function pick(collection, n = 3) {
  return (collection || []).slice(0, n);
}

module.exports = {
  eleventyComputed: {
    projects: data => pick(data.collections.projects),
    concepts: data => pick(data.collections.concepts),
    sparks: data => pick(data.collections.sparks),
    meta: data => pick(data.collections.meta)
  }
};
