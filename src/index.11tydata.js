function takeLatest(collection, n = 3) {
  return [...(collection || [])]
    .sort((a, b) => b.date - a.date)
    .slice(0, n);
}

module.exports = {
  eleventyComputed: {
    work: data => {
      const normalize = (items = [], type) =>
        items.map(i => ({ url: i.url, data: i.data, date: i.date, type }));
      return [
        ...normalize(data.collections.projects, 'project'),
        ...normalize(data.collections.concepts, 'concept'),
        ...normalize(data.collections.sparks, 'spark'),
        ...normalize(data.collections.meta, 'meta')
      ]
        .sort((a, b) => b.date - a.date)
        .slice(0, 9);
    }
  }
};
