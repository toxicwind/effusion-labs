// Redirect stub: /work/latest → newest work item
export const data = {
  layout: "layouts/redirect.njk",
  permalink: "/work/latest/index.html",
  eleventyComputed: {
    redirect: data => {
      const workItems = (data.collections.work || [])
        .sort((a, b) => b.date - a.date);
      const latest = workItems[0];
      return latest ? latest.url : "/work/";
    }
  }
};

// Output nothing, layout handles redirect
export const render = () => "";
