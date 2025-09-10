// Redirect: /work/drop → newest item with type "drop"
export const data = {
  layout: "layouts/redirect.njk",
  permalink: "/work/drop/index.html",
  eleventyComputed: {
    // Skip Interlinker on this JS template to avoid .match() on non-strings
    outboundLinks: () => [],
    redirect: (data) => {
      const items = Array.isArray(data.collections?.work) ? data.collections.work : [];
      const drops = items
        .filter((item) => (item?.data?.type || "").toLowerCase() === "drop")
        .sort((a, b) => (b?.date?.valueOf?.() ?? 0) - (a?.date?.valueOf?.() ?? 0));
      return drops[0]?.url ?? "/work/";
    },
  },
};

// Emit a visible fallback; layout still handles the real redirect.
export const render = (data) => {
  const to = data?.redirect ?? "/work/";
  return `<p>Redirecting to <a href="${to}">${to}</a>…</p>`;
};
