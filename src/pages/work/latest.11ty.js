// Redirect: /work/latest → newest work item (any type)
export const data = {
  layout: "layouts/redirect.njk",
  permalink: "/work/latest/index.html",
  eleventyComputed: {
    outboundLinks: () => [],
    redirect: (data) => {
      const items = Array.isArray(data.collections?.work) ? data.collections.work : [];
      const sorted = items.sort((a, b) => (b?.date?.valueOf?.() ?? 0) - (a?.date?.valueOf?.() ?? 0));
      return sorted[0]?.url ?? "/work/";
    },
  },
};

export const render = (data) => {
  const to = data?.redirect ?? "/work/";
  return `<p>Redirecting to <a href="${to}">${to}</a>…</p>`;
};
