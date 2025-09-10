// eleventy.config.mjs (FIXED with all original logic)
import register from "./config/register.js"; // Corrected path
import { DateTime } from "luxon";
import { dirs } from "./config/site.js"; // Corrected path
import seeded from "./helpers/utils/seeded.js"; // Corrected path
import registerArchive from "./config/archives.mjs"; // Corrected path
import { getBuildInfo } from "./config/build-info.js"; // Corrected path
import fs from "node:fs";
import path from "node:path";

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

// Uppercase only when safe
const safeUpper = (value, fallback = "", coerce = false) => {
  if (typeof value === "string") return value.toUpperCase();
  if (value == null) return fallback;
  return coerce ? String(value).toUpperCase() : fallback;
};

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
</aside>`.trim();
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
  eleventyConfig.addFilter("date", (value, fmt = "yyyy-LL-dd") => {
    try {
      let dt;
      if (value instanceof Date) dt = DateTime.fromJSDate(value, { zone: "utc" });
      else if (typeof value === "number") dt = DateTime.fromMillis(value, { zone: "utc" });
      else if (typeof value === "string") dt = DateTime.fromISO(value, { zone: "utc" });
      else return "";
      return dt.isValid ? dt.toFormat(fmt) : "";
    } catch {
      return "";
    }
  });

  eleventyConfig.addFilter("byCharacter", (items, id) => {
    const target = slug(id);
    return (items ?? []).filter((p) => slug(p?.data?.charSlug ?? p?.data?.character) === target);
  });

  eleventyConfig.addFilter("bySeries", (items, id) => {
    const target = slug(id);
    return (items ?? []).filter((p) => slug(p?.data?.seriesSlug ?? p?.data?.series) === target);
  });

  eleventyConfig.addFilter("sortByReleaseDate", (items, dir = "asc") => {
    const arr = [...(items ?? [])];
    arr.sort((a, b) =>
      String(a?.data?.release_date ?? "").localeCompare(String(b?.data?.release_date ?? ""))
    );
    return dir === "desc" ? arr.reverse() : arr;
  });

  eleventyConfig.addFilter("seededShuffle", (arr, seed) => seeded.seededShuffle(arr, seed));
  eleventyConfig.addFilter("safe_upper", safeUpper);
  eleventyConfig.addFilter("compactUnique", (arr) => Array.from(new Set((arr || []).filter(Boolean))));

  const toJson = (value, spaces = 0) =>
    JSON.stringify(value, null, spaces)
      .replace(/</g, "\\u003C")
      .replace(/-->/g, "\\u002D\\u002D>");
  eleventyConfig.addFilter("json", toJson);
  eleventyConfig.addNunjucksFilter("json", toJson);

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
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const redirectsFile = path.join(dir.output, "_redirects");
    if (fs.existsSync(redirectsFile)) {
      const lines = fs.readFileSync(redirectsFile, "utf8").split(/\n/).filter(Boolean);
      for (const line of lines) {
        const [from, to] = line.split(/\s+/);
        if (!from || !to) continue;
        const outPath = path.join(dir.output, from, "index.html");
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"></head><body><p>Redirecting to <a href="${to}">${to}</a></p></body></html>`;
        fs.writeFileSync(outPath, html);
      }
    }
    // Snapshot...
    try {
      const items = eleventyConfig.globalData?.archiveProductMap || [];
      if (items && items.length) {
        fs.mkdirSync('logs', { recursive: true });
        fs.writeFileSync(path.join('logs', 'archiveProductMap.cache.json'), JSON.stringify(items, null, 2));
      }
    } catch { }
  });
  eleventyConfig.addPassthroughCopy('_redirects');

  return {
    dir: dirs,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html", "11ty.js"],
    pathPrefix: "/",
  };
}