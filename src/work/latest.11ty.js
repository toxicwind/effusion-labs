exports.data = {
  layout: "layouts/redirect.njk",
  permalink: "/work/latest/index.html",
  eleventyComputed: {
    redirect: data => {
      const w = data.collections.work && data.collections.work[0];
      return w ? w.url : '/work/';
    }
  }
};

exports.render = () => '';
