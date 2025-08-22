// src/_data/home.js
export default {
  // Hero copy
  title: "Ideas, prototypes, and tools—shipped straight from the lab.",
  lede: "Effusion Labs explores concepts until they become working systems. Browse projects in progress, sparks of inspiration, and the models that tie them together.",

  eleventyComputed: {
    // Hero CTAs
    ctas: data => {
      const projects = (data.collections.projects || [])
        .sort((a, b) => b.date - a.date);
      const latestProject = projects[0];
      return [
        {
          href: latestProject ? latestProject.url : "/work",
          label: "Try the latest build"
        },
        {
          href: "/work",
          label: "Browse all work",
          variant: "ghost"
        }
      ];
    },

    // Hero tiles: newest item of each type
    tiles: data => {
      const all = data.collections.work || [];
      const categories = [
        { kind: "project", heading: "Latest Project", subheading: "The newest prototype you can test" },
        { kind: "concept", heading: "Core Concepts", subheading: "Frameworks and structural notes" },
        { kind: "spark",   heading: "Fresh Sparks",  subheading: "Quick ideas and early sketches" },
        { kind: "meta",    heading: "Meta Notes",    subheading: "Process and methodology context" }
      ];
      return categories.map(cat => {
        const item = all.find(i => i.type === cat.kind);
        return {
          ...cat,
          url: item ? item.url : "/work",
          featured: cat.kind === "project"
        };
      });
    },

    // Grid of up to 9: diverse + recent
    work: data => {
      const col = data.collections.work || [];
      const required = ["project","concept","spark","meta"];
      const result = [];
      const seen = new Set();

      for (const type of required) {
        const match = col.find(i => i.type === type);
        if (match) { result.push(match); seen.add(match.url); }
      }

      for (const item of col) {
        if (result.length >= 9) break;
        if (!seen.has(item.url)) {
          result.push(item);
          seen.add(item.url);
        }
      }
      return result;
    },

    // Latest 3 projects (for sidebar/footer blocks etc.)
    projects: data =>
      (data.collections.projects || [])
        .sort((a, b) => b.date - a.date)
        .slice(0, 3)
  }
};
