module.exports = {
  eleventyComputed: {
    work: data => (data.collections.work || []).slice(0, 9)
  }
};
