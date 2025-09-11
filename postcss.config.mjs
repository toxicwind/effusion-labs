// Tailwind v4 runs via @tailwindcss/postcss.
// We layer a few common plugins; cssnano only in production.

import tailwindcss from "@tailwindcss/postcss";
import postcssReporter from "postcss-reporter";
import postcssSortMQ from "postcss-sort-media-queries";
import postcssInlineSvg from "postcss-inline-svg";
import postcssNormalize from "postcss-normalize";
// If you want autoprefixer back, uncomment:
// import autoprefixer from "autoprefixer";

const isProd = process.env.NODE_ENV === "production";

export default {
  plugins: [
    tailwindcss,
    // autoprefixer, // optional with Tailwind v4; modern browsers typically fine
    postcssInlineSvg(),              // inline small SVGs
    postcssSortMQ({ sort: "desktop-first" }), // or "mobile-first"
    postcssNormalize(),              // add/merge normalize per browserlist
    isProd && (await import("cssnano")).default({
      preset: ["default", { discardComments: { removeAll: true } }],
    }),
    postcssReporter({ clearReportedMessages: true }),
  ].filter(Boolean),
};
