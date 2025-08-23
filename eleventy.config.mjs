// eleventy.config.mjs (root)
import register from "./lib/eleventy/register.mjs";
import { dirs } from "./lib/config.js";
import seeded from "./lib/seeded.js";
import registerArchive from "./lib/eleventy/archives.mjs";
import { getBuildInfo } from "./lib/build-info.js";

// tiny local slugger (keeps filters resilient)
const slug = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// minimal HTML escaper for shortcode args
const escapeHtml = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function createCalloutShortcode(eleventyConfig) {
  return function (content, opts = {}) {
    const md = eleventyConfig.markdownLibrary;
    const isObj = opts && typeof opts === "object" && !Array.isArray(opts);
    const {
      title = "",
      kicker = "",
      variant = "neutral",
      position = "center",
      icon = "",
      headingLevel = 3,
    } = isObj ? opts : { title: opts };
    const envEscape = this?.env?.filters?.escape ?? escapeHtml;
    const safeTitle = envEscape(title);
    const safeKicker = kicker ? envEscape(kicker) : "";
    const safeVariant = String(variant).toLowerCase().replace(/[^\w-]/g, "");
    const safePosition = String(position).toLowerCase().replace(/[^\w-]/g, "");
    const clampedLevel = Math.min(6, Math.max(2, Number(headingLevel) || 3));
    const tag = `h${clampedLevel}`;
    const id = `callout-${title ? slug(title) : Date.now()}`;
    const safeId = envEscape(id);
    const classes = ["callout", `callout--${safeVariant}`, `callout--dock-${safePosition}`].join(" ");
    const iconMarkup =
      icon && /^<svg[\s>]/.test(String(icon))
        ? String(icon)
        : icon
        ? `<span class="callout-icon" aria-hidden="true">${envEscape(icon)}</span>`
        : "";

    const env = this.ctx ?? {};
    const tokens = md.parse(String(content), env);
    const footnoteStart = tokens.findIndex((t) => t.type === "footnote_block_open");
    const bodyTokens = footnoteStart >= 0 ? tokens.slice(0, footnoteStart) : tokens;
    const body = md.renderer.render(bodyTokens, md.options, env).trim();

    return `
<aside class="${classes}" role="note" aria-labelledby="${safeId}">
  <div class="callout-head">
    <${tag} id="${safeId}" class="callout-title">${iconMarkup}${safeTitle}</${tag}>
    ${safeKicker ? `<p class="callout-kicker">${safeKicker}</p>` : ''}
  </div>
  <div class="callout-body">
    ${body}
  </div>
</aside><!-- -->
`.trim();
  };
}

export default function (eleventyConfig) {
  const buildTime = new Date().toISOString();

  // Core project wiring (markdown, assets, images, etc.)
  register(eleventyConfig);

  // capture markdown library for shortcodes
  eleventyConfig.amendLibrary('md', (md) => {
    eleventyConfig.markdownLibrary = md;
    return md;
  });

  // 🔐 Load JSON archives → stable collections + helpers
  // Exposes: collections.archiveProducts / archiveCharacters / archiveSeries
  // and filters: byLine, byCompany, byLocale, uniqueBy (+ global archiveCompanies, archiveLines)
  registerArchive(eleventyConfig);

  // ---- Site-specific collections (unchanged semantics) ----
  eleventyConfig.addCollection("featured", (api) =>
    api.getAll().filter((p) => p.data?.featured === true).sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("interactive", (api) =>
    api
      .getAll()
      .filter((p) => {
        const tags = p.data.tags || [];
        return tags.includes("prototype") || p.data.interactive === true;
      })
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("recentAll", (api) => {
    const items = api.getAll().filter((p) => p.data.type);
    items.sort((a, b) => b.date - a.date);
    items.take = (n) => items.slice(0, n);
    return items;
  });

  // ---- Filters that play nicely with archive data ----
  // Match products by character (accepts name or slug)
  eleventyConfig.addFilter("byCharacter", (items, id) => {
    const target = slug(id);
    return (items ?? []).filter((p) => slug(p?.data?.charSlug ?? p?.data?.character) === target);
  });

  // Match products by series (accepts title or slug)
  eleventyConfig.addFilter("bySeries", (items, id) => {
    const target = slug(id);
    return (items ?? []).filter((p) => slug(p?.data?.seriesSlug ?? p?.data?.series) === target);
  });

  // Sort helpers (non-mutating)
  eleventyConfig.addFilter("sortByReleaseDate", (items, dir = "asc") => {
    const arr = [...(items ?? [])];
    arr.sort((a, b) =>
      String(a?.data?.release_date ?? "").localeCompare(String(b?.data?.release_date ?? ""))
    );
    return dir === "desc" ? arr.reverse() : arr;
  });

  eleventyConfig.addFilter("seededShuffle", (arr, seed) => seeded.seededShuffle(arr, seed));

  // ---------- unified callout shortcode ----------
  const callout = createCalloutShortcode(eleventyConfig);
  eleventyConfig.addPairedShortcode('callout', callout);

  // ---- Legacy aliases ----
  eleventyConfig.addPairedShortcode('failbox', function (content, titleOrOpts, kicker) {
    const opts =
      titleOrOpts && typeof titleOrOpts === 'object' && !Array.isArray(titleOrOpts)
        ? { ...titleOrOpts }
        : { title: titleOrOpts, kicker };
    return callout.call(this, content, opts);
  });
  eleventyConfig.addPairedShortcode('failitem', function (content, label = '') {
    const envEscape = this?.env?.filters?.escape ?? escapeHtml;
    const safeLabel = label ? `**${envEscape(label)}** ` : '';
    return `- ${safeLabel}${content}`.trim();
  });


// ---- Global data ----
  eleventyConfig.addGlobalData("buildTime", buildTime);
  eleventyConfig.addGlobalData("dailySeed", seeded.dailySeed);
  eleventyConfig.addGlobalData("homepageCaps", {
    featured: 3,
    today: 3,
    tryNow: [1, 3],
    pathways: 3,
    questions: 3,
    notebook: 3,
  });
  const build = getBuildInfo();
  eleventyConfig.addGlobalData("build", build);

  return {
    dir: dirs,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html", "11ty.js"],
    pathPrefix: "/",
  };
}
