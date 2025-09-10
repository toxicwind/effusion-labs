export default {
  eleventyComputed: {
    permalink: (data) => {
      if (data.permalink) return data.permalink;
      if (data.page.fileSlug === 'index' || data.page.fileSlug === '_index') {
        return '/sparks/';
      }
      return `/sparks/${data.page.fileSlug}/`;
    },
    layout: (data) => data.layout ?? 'layouts/base.njk',
  },
};
