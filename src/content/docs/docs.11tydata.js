export default {
  tags: ["docs"],
  eleventyComputed: {
    permalink: data => {
      if (data.permalink) return data.permalink;
      if (data.page.fileSlug === "index" || data.page.fileSlug === "_index") {
        return "/docs/";
      }
      // Preserve the subdirectory path to avoid collisions between
      // same-named files in different docs subfolders.
      const rel = data.page.filePathStem.replace(/^\/content\/docs\//, "");
      const parts = rel.split("/").filter(Boolean);
      parts.pop();
      const sub = parts.length ? parts.join("/") + "/" : "";
      return `/docs/${sub}${data.page.fileSlug}/`;
    },
    layout: data => data.layout ?? "base.njk",
  },
};
