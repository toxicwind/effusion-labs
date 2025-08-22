// Redirect stub: /work/drop → newest "drop" work item
export const data = {
  layout: "layouts/redirect.njk",
  permalink: "/work/drop/index.html",
  eleventyComputed: {
    redirect: data => {
      const drops = (data.collections.work || [])
        .filter(item => item.type === "drop")
        .sort((a, b) => b.date - a.date);
      const latestDrop = drops[0];
      return latestDrop ? latestDrop.url : "/work/";
    }
  }
};

export const render = () => "";
