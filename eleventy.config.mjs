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

export default function (eleventyConfig) {
  const buildTime = new Date().toISOString();

  // Core project wiring (markdown, assets, images, etc.)
  register(eleventyConfig);

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

  // ---------- failbox / failitem paired shortcodes (ESM) ----------
  const normalizeBoxOpts = function (ctx, titleOrOpts, kicker) {
    // Supports:
    // {% failbox "Title", "Kicker" %}
    // {% failbox title="Title" kicker="Kicker" variant="warn" collapsible=true %}
    const isObj =
      titleOrOpts && typeof titleOrOpts === "object" && !Array.isArray(titleOrOpts);
    const envEscape =
      ctx && ctx.env && ctx.env.filters && typeof ctx.env.filters.escape === "function"
        ? ctx.env.filters.escape
        : escapeHtml;

    const opts = isObj ? { ...titleOrOpts } : { title: titleOrOpts, kicker };

    const {
      title = "FAILURE MODES WORTH RESPECTING",
      kicker: kk = "",
      variant = "neutral", // neutral | info | warn | danger
      headingLevel = 3, // 2..6
      collapsible = false,
      open = true, // only used when collapsible=true
      id,
      class: extraClass = "",
      icon = "", // raw SVG or text
    } = opts;

    const safeTitle = envEscape(title);
    const safeKicker = kk ? envEscape(kk) : "";
    const clampedLevel = Math.min(6, Math.max(2, Number(headingLevel) || 3));
    const tag = `h${clampedLevel}`;
    const generatedId = id || (title ? `failbox-${slug(title)}` : `failbox-${Date.now()}`);
    const safeId = envEscape(generatedId);
    const safeVariant = String(variant).toLowerCase().replace(/[^\w-]/g, "");
    const safeExtraClass = envEscape(extraClass);
    const boxClasses = ["failbox", `failbox--${safeVariant}`, safeExtraClass]
      .filter(Boolean)
      .join(" ");

    const iconMarkup =
      icon && /^<svg[\s>]/.test(String(icon))
        ? String(icon) // inline SVG trusted from repo source
        : icon
        ? `<span class="failbox-icon" aria-hidden="true">${envEscape(icon)}</span>`
        : "";

    return {
      safeTitle,
      safeKicker,
      tag,
      safeId,
      boxClasses,
      collapsible: Boolean(collapsible),
      open: Boolean(open),
      iconMarkup,
    };
  };

  const normalizeItemOpts = function (ctx, labelOrOpts) {
    // Supports:
    // {% failitem "Label" %}...{% endfailitem %}
    // {% failitem label="Label" tone="warn" %}
    const isObj = labelOrOpts && typeof labelOrOpts === "object" && !Array.isArray(labelOrOpts);
    const envEscape =
      ctx && ctx.env && ctx.env.filters && typeof ctx.env.filters.escape === "function"
        ? ctx.env.filters.escape
        : escapeHtml;

    const opts = isObj ? { ...labelOrOpts } : { label: labelOrOpts };

    const {
      label = "",
      tone = "neutral", // neutral | info | warn | danger | good
      class: extraClass = "",
      icon = "",
    } = opts;

    const safeLabel = label ? envEscape(label) : "";
    const safeTone = String(tone).toLowerCase().replace(/[^\w-]/g, "");
    const safeExtraClass = envEscape(extraClass);
    const classes = ["failitem", `failitem--${safeTone}`, safeExtraClass]
      .filter(Boolean)
      .join(" ");
    const iconMarkup =
      icon && /^<svg[\s>]/.test(String(icon))
        ? String(icon)
        : icon
        ? `<span class="failitem-icon" aria-hidden="true">${envEscape(icon)}</span>`
        : "";

    return { safeLabel, classes, iconMarkup, hasLabel: Boolean(label) };
  };

  eleventyConfig.addPairedShortcode("failbox", function (content, titleOrOpts, kicker) {
    const {
      safeTitle,
      safeKicker,
      tag,
      safeId,
      boxClasses,
      collapsible,
      open,
      iconMarkup,
    } = normalizeBoxOpts(this, titleOrOpts, kicker);
  const contentInner = content.trim();

    const headerInner = `
      <div class="failbox-head">
        <${tag} id="${safeId}" class="failbox-title">${iconMarkup}${safeTitle}</${tag}>
        ${safeKicker ? `<p class="failbox-kicker">${safeKicker}</p>` : ""}
      </div>`.trim();

    const bodyInner = `
      <div class="failbox-body">
        ${contentInner}
      </div>`.trim();

    if (collapsible) {
      return `
<aside class="${boxClasses}" role="note" aria-labelledby="${safeId}">
  <details class="failbox-collapse"${open ? " open" : ""}>
    <summary class="failbox-summary">${headerInner}</summary>
    ${bodyInner}
  </details></aside><!-- -->
`.trimStart();
    }

    return `
<aside class="${boxClasses}" role="note" aria-labelledby="${safeId}">
  ${headerInner}
  ${bodyInner}</aside><!-- -->
`.trimStart();
  });

  eleventyConfig.addPairedShortcode("failitem", function (content, labelOrOpts = "") {
    const { safeLabel, classes, iconMarkup, hasLabel } = normalizeItemOpts(this, labelOrOpts);
    const heading = hasLabel
      ? `<div class="failitem-label"><strong>${iconMarkup}${safeLabel}</strong></div>`
      : "";
    const inner = content.trim();

    return `
<section class="${classes}">
  ${heading}
  <div class="failitem-content">
    ${inner}
  </div>
</section>`.trim();
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
