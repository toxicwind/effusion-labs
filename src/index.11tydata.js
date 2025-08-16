module.exports = {
  eleventyComputed: {
    work: data => (data.collections.work || []).slice(0, 9),
    projects: data =>
      (data.collections.projects || [])
        .sort((a, b) => b.date - a.date)
        .slice(0, 3)
  }
};
