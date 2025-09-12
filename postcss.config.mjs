// postcss.config.mjs
// Tailwind v4 official plugin + common quality-of-life plugins.
// Tailwind v4 bundles nesting & autoprefixing via @tailwindcss/postcss.  🛈
// https://tailwindcss.com/blog/tailwindcss-v4-beta (v4 plugin stack) 
import tailwind from "@tailwindcss/postcss";
import inlineSvg from "postcss-inline-svg";
import normalize from "postcss-normalize";
import sortMediaQueries from "postcss-sort-media-queries";
import reporter from "postcss-reporter";
import cssnano from "cssnano";

const isProd = process.env.NODE_ENV === "production";

export default {
  plugins: [
    // 1) Tailwind (includes nesting + autoprefixer under the hood)
    tailwind,
    // 2) Extras (order matters: transforms before minification)
    inlineSvg(),
    sortMediaQueries(),
    normalize(),
    reporter({ clearReportedMessages: true }),
    ...(isProd ? [cssnano({ preset: "default" })] : []),
  ],
};
