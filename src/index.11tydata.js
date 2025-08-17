module.exports = {
  title: "Experimental R&D you can actually use.",
  lede: "Prototypes, systems, and notes from the lab.",
  ctas: [
    { href: "/work/latest", label: "See the latest drop" },
    { href: "/work", label: "Explore the lab", kind: "ghost" }
  ],
  tiles: [
    { k: "project", h: "Latest Project", s: "Try the newest build", url: "/work/latest", featured: true },
    { k: "concept", h: "Core Concepts", s: "Structural notes and models", url: "/work" },
    { k: "spark", h: "Fresh Sparks", s: "Quick experiments and ideas", url: "/work" }
  ],
  eleventyComputed: {
    work: data => {
      const col = data.collections.work || [];
      const required = ['project','concept','spark','meta'];
      const result = [];
      const usedUrls = new Set();
      // ensure at least one of each required type
      for (const type of required) {
        const item = col.find(i => i.type === type);
        if (item) {
          result.push(item);
          usedUrls.add(item.url);
        }
      }
      // fill remaining slots with most recent items not already used
      for (const item of col) {
        if (result.length >= 9) break;
        if (!usedUrls.has(item.url)) {
          result.push(item);
          usedUrls.add(item.url);
        }
      }
      return result;
    },
    projects: data =>
      (data.collections.projects || [])
        .sort((a, b) => b.date - a.date)
        .slice(0, 3)
  }
};
