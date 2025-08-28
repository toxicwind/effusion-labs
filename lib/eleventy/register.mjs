// lib/eleventy/register.mjs
import markdownItFootnote from "markdown-it-footnote";
import markdownItAttrs from "markdown-it-attrs";
import markdownItAnchor from "markdown-it-anchor";
import markdownItShiki from "@shikijs/markdown-it";
import { transformerNotationDiff, transformerNotationHighlight } from "@shikijs/transformers";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import path from "node:path";
import fs from "node:fs";
import slugify from "slugify";
import { dirs } from "../config.js";
import { icons } from "lucide";

import getPlugins from "../plugins.js";
import filters from "../filters.js";
import { applyMarkdownExtensions } from "../markdown/index.js";
import { specnote } from "../shortcodes.js";
import { CONTENT_AREAS, baseContentPath } from "../constants.js";
import { runPostcssAll } from "../postcss.js";

const glob = (d) => `${baseContentPath}/${d}/**/*.md`;

export default function register(eleventyConfig) {
  const plugins = getPlugins();
  plugins.forEach(([plugin, opts = {}]) => eleventyConfig.addPlugin(plugin, opts));

  if (process.env.ELEVENTY_ENV !== "test") {
    eleventyConfig.ignores.add("test/**");
    eleventyConfig.ignores.add("src/test/**");
  }

  const isTest = process.env.ELEVENTY_ENV === "test";
  const allowImages = process.env.ELEVENTY_TEST_ENABLE_IMAGES === "1";

  // Markdown (Shiki @ build time, footnotes, attrs, anchors)
  eleventyConfig.amendLibrary("md", (md) => {
    md.use(markdownItShiki, {
      themes: { light: "github-light", dark: "github-dark" },
      transformers: [
        {
          pre(node) {
            node.properties.tabindex = 0;
          },
          line(node, i) {
            node.properties["data-line"] = i + 1;
          },
        },
        transformerNotationDiff(),
        transformerNotationHighlight(),
      ],
    });
    md.use(markdownItFootnote);
    md.use(markdownItAttrs);
    md.use(
      markdownItAnchor,
      {
        permalink: markdownItAnchor.permalink.headerLink({
          symbol: "#",
          class: "heading-anchor",
          placement: "before",
        }),
      }
    );
    applyMarkdownExtensions(md);
    return md;
  });

  // Server-side Lucide (for macros like components/icons.njk)
  eleventyConfig.addFilter("lucide", (name, attrs = {}) => {
    const icon = icons[name];
    return icon ? icon.toSvg(attrs) : "";
  });

  // Project filters
  Object.entries(filters).forEach(([key, value]) => {
    eleventyConfig.addFilter(key, value);
  });

  // Content-area collections
  const singular = { sparks: "spark", concepts: "concept", projects: "project", meta: "meta" };
  const workAreas = ["sparks", "concepts", "projects", "meta"];

  CONTENT_AREAS.forEach((name) => {
    eleventyConfig.addCollection(name, (api) =>
      api
        .getFilteredByGlob(glob(name))
        .sort((a, b) => b.date - a.date)
        .map((page) => {
          page.data.type = singular[name];
          return page;
        })
    );
  });

  eleventyConfig.addCollection("work", (api) =>
    workAreas
      .flatMap((name) =>
        api.getFilteredByGlob(glob(name)).map((page) => ({
          url: page.url,
          data: page.data,
          date: page.date,
          type: singular[name],
        }))
      )
      .sort((a, b) => b.date - a.date)
  );

  // JSONL Provenance viewer entries (SSR or client-rendered)
  // Scans src/content/archives for *.jsonl and exposes metadata for pagination
  eleventyConfig.addCollection("jsonlProvenance", () => {
    const base = path.join('src','content','archives');
    const toPosix = (p) => p.replaceAll('\\','/');
    const out = [];
    const walk = (d) => {
      if (!fs.existsSync(d)) return;
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.isFile() && p.endsWith('.jsonl')) {
          const rel = toPosix(path.relative(base, p));
          const parts = rel.split('/');
          const industry = parts[0], category = parts[1], company = parts[2], line = parts[3];
          const baseName = path.basename(p, '.jsonl');
          const slug = baseName.replace(/--+/g, '-');
          out.push({
            abs: p,
            rel,
            industry,
            category,
            company,
            line,
            base: baseName,
            slug,
            rawUrl: `/content/${rel}`,
            viewerUrl: `/archives/${industry}/${category}/${company}/${line}/provenance/${slug}/`,
          });
        }
      }
    };
    walk(base);
    return out.sort((a,b)=> a.base.localeCompare(b.base));
  });

  // Group JSONL entries by directory (industry/category/company/line)
  eleventyConfig.addCollection("jsonlDirs", () => {
    const base = path.join('src','content','archives');
    const toPosix = (p) => p.replaceAll('\\','/');
    const out = [];
    const walk = (d) => {
      if (!fs.existsSync(d)) return;
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.isFile() && p.endsWith('.jsonl')) {
          const rel = toPosix(path.relative(base, p));
          const parts = rel.split('/');
          out.push({
            rel,
            industry: parts[0], category: parts[1], company: parts[2], line: parts[3],
            base: path.basename(p, '.jsonl'),
            slug: path.basename(p, '.jsonl').replace(/--+/g, '-'),
            rawUrl: `/content/${rel}`,
          });
        }
      }
    };
    walk(base);
    const groups = new Map();
    for (const f of out) {
      const relDir = [f.industry, f.category, f.company, f.line].join('/');
      if (!groups.has(relDir)) groups.set(relDir, []);
      groups.get(relDir).push(f);
    }
    return Array.from(groups.entries()).map(([rel, items]) => ({ rel, url: `/content/archives/${rel}/`, items: items.sort((a,b)=> a.base.localeCompare(b.base)) }));
  });

  eleventyConfig.addCollection("nodes", (api) =>
    api
      .getFilteredByGlob(CONTENT_AREAS.map(glob))
      .map((page) => {
        const type = singular[CONTENT_AREAS.find((a) => page.inputPath.includes(a))];
        if (type) page.data.type = type;
        return page;
      })
      .sort((a, b) => b.date - a.date)
  );

  // Images
  if (!isTest || allowImages) {
    eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
      urlPath: "/assets/images/",
      outputDir: path.join(dirs.output, "assets/images/"),
      formats: ["avif", "webp", "auto"],
      widths: [320, 640, 960, 1200, 1800, "auto"],
      htmlOptions: {
        imgAttributes: { loading: "lazy", decoding: "async" },
        pictureAttributes: {},
      },
      filenameFormat: (id, src, width, format) => {
        const { name } = path.parse(src);
        const s = slugify(name, { lower: true, strict: true });
        return `${s}-${width}.${format}`;
      },
    });
  }

  // Assets & watches
  eleventyConfig.addPassthroughCopy({ "src/scripts": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "src/assets/static": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  // Intentionally avoid publishing /content/**; JSONL is re-published under /archives/**.
  // Keep namespaced copies under /assets/icons for direct references
  eleventyConfig.addPassthroughCopy({ "src/assets/icons": "assets/icons" });
  // Also publish key icons + manifest to web root for standard link tags
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/favicon-96x96.png": "favicon-96x96.png" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/apple-touch-icon.png": "apple-touch-icon.png" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/site.webmanifest": "site.webmanifest" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/web-app-manifest-192x192.png": "web-app-manifest-192x192.png" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/web-app-manifest-512x512.png": "web-app-manifest-512x512.png" });
  eleventyConfig.addWatchTarget("src/styles");
  eleventyConfig.addWatchTarget("src/assets/static");
  // Watch archives so raw JSONL changes live-reload in dev
  eleventyConfig.addWatchTarget("src/content/archives");
  eleventyConfig.addWatchTarget("tailwind.config.mjs");
  eleventyConfig.addWatchTarget("postcss.config.mjs");

  // Eleventy Dev Server (v3) — enable DOM-diffing and watch compiled CSS for quick injection
  if (eleventyConfig.setServerOptions) {
    // Always serve .jsonl with a proper NDJSON content type in dev
    const onRequest = {
      "/content/:rest*": ({ url, patternGroups }) => {
        const rest = patternGroups?.rest || "";
        const rel = path.posix.join("content", rest);
        const abs = path.join(dirs.output, rel);
        if (!fs.existsSync(abs)) return; // let static chain decide (likely 404)
        const isDir = fs.statSync(abs).isDirectory();
        if (isDir) {
          const entries = fs.readdirSync(abs, { withFileTypes: true });
          const rows = entries
            .sort((a,b)=> a.name.localeCompare(b.name))
            .map(ent => {
              const href = url.pathname.replace(/\/$/, "") + "/" + ent.name + (ent.isDirectory()? "/" : "");
              const label = ent.name + (ent.isDirectory()? "/" : "");
              return `<li><a class="link" href="${href}">${label}</a></li>`;}
            ).join("\n");
          const up = url.pathname.replace(/\/$/, "").split("/").slice(0,-1).join("/") + "/";
          const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Index of ${url.pathname}</title><link rel="stylesheet" href="/assets/css/app.css"/></head><body><main class="p-4 max-w-4xl mx-auto"><h1 class="text-xl font-mono mb-3">Index of ${url.pathname}</h1><p class="mb-3"><a class="link" href="${up}">../</a></p><ul class="space-y-1">${rows}</ul></main></body></html>`;
          return { headers: { "Content-Type": "text/html; charset=utf-8" }, body };
        }
        // File response
        const ext = path.extname(abs).toLowerCase();
        const headers = {};
        if (ext === ".jsonl") headers["Content-Type"] = "application/x-ndjson; charset=utf-8";
        else if (ext === ".json") headers["Content-Type"] = "application/json; charset=utf-8";
        else headers["Content-Type"] = "application/octet-stream";
        if (url.searchParams.get("download") === "1") {
          const filename = path.basename(abs);
          headers["Content-Disposition"] = `attachment; filename=\"${filename}\"`;
        }
        const body = fs.readFileSync(abs);
        return { headers, body };
      },
      // Dev-only dynamic viewer for provenance JSONL using Shiki
      "/archives/:industry/:category/:company/:line/provenance/:slug": async ({ url, patternGroups }) => {
        try {
          const { codeToHtml } = await import('shiki');
          const { industry, category, company, line, slug } = patternGroups;
          const baseDir = path.join('src','content','archives', industry, category, company, line, 'provenance');
          if (!fs.existsSync(baseDir)) return;
          const toSlug = (b) => String(b).replace(/--+/g, '-');
          const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.jsonl'));
          const match = files.find(f => toSlug(f.replace(/\.jsonl$/, '')) === slug);
          if (!match) return; // let static try (likely 404)
          const abs = path.join(baseDir, match);
          const code = fs.readFileSync(abs, 'utf8');
          const html = await codeToHtml(code, { lang: 'jsonl', themes: { light: 'github-light', dark: 'github-dark' } });
          const title = match.replace(/\.jsonl$/, '');
          const rawUrl = `/content/archives/${industry}/${category}/${company}/${line}/provenance/${match}`;
          const body = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Provenance — ${title}</title>
  <link rel="stylesheet" href="/assets/css/app.css" />
  <style>main{max-width:72rem;margin:0 auto;padding:1rem}</style>
  </head>
<body>
  <main>
    <nav class="breadcrumbs text-sm mb-2 overflow-x-auto whitespace-nowrap" aria-label="Breadcrumb">
      <ul>
        <li><a href="/archives/">Archives</a></li>
        <li><a href="/archives/${industry}/">${industry}</a></li>
        <li><a href="/archives/${industry}/${category}/">${category}</a></li>
        <li><a href="/archives/${industry}/${category}/${company}/">${company}</a></li>
        <li><a href="/archives/${industry}/${category}/${company}/${line}/">${line}</a></li>
        <li class="opacity-70">Provenance</li>
      </ul>
    </nav>
    <header class="mb-4">
      <h1 class="font-heading text-3xl uppercase tracking-[-0.02em] text-primary mb-1">${title}</h1>
      <div class="text-sm opacity-80 space-x-3">
        <a class="link" href="${rawUrl}">View raw JSONL</a>
        <a class="link" href="${rawUrl}?download=1">Download</a>
      </div>
    </header>
    <section class="card bg-base-100 border shadow-sm">
      <div class="card-body p-0">
        <div class="overflow-auto" style="max-height: 70vh">${html}</div>
      </div>
    </section>
  </main>
</body>
</html>`;
          return { headers: { 'Content-Type': 'text/html; charset=utf-8' }, body };
        } catch (e) {
          console.error('[jsonl viewer] error', e);
        }
      },
      "/archives/:industry/:category/:company/:line/provenance/:slug/": async (args) => onRequest["/archives/:industry/:category/:company/:line/provenance/:slug"](args),
    };
    eleventyConfig.setServerOptions({
      showAllHosts: true,
      domDiff: true,
      port: 8080,
      encoding: "utf-8",
      watch: ["_site/assets/css/**/*.css"],
      onRequest,
    });
  } else {
    // Fallback for BrowserSync
    eleventyConfig.setBrowserSyncConfig({
      index: "index.html",
      server: { baseDir: "_site" },
      files: ["_site/assets/css/**/*.css"],
    });
  }

  eleventyConfig.addShortcode("specnote", specnote);

  if (!isTest) {
    eleventyConfig.on("eleventy.before", async () => {
      console.log("🚀 Eleventy build starting with enhanced footnote system...");
      if (process.env.CSS_WATCH === "1") return; // external watcher handles CSS
      await runPostcssAll([
        { src: "src/styles/app.tailwind.css", dest: "src/assets/css/app.css" },
        { src: "src/styles/mschf-overlay.css", dest: "src/assets/css/mschf-overlay.css" },
      ]);
    });
    eleventyConfig.on("eleventy.after", ({ results }) => {
      console.log(`✅ Eleventy build completed. Generated ${results.length} files.`);
    });
  }
}
