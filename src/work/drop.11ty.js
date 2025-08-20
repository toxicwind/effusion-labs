export const data = {
  layout: "layouts/redirect.njk",
  permalink: "/work/drop/index.html",
  eleventyComputed: {
    redirect: data => {
      const w = data.collections.work && data.collections.work[0];
      return w ? w.url : '/work/';
    }
  }
};

export const render = () => '';
