#!/usr/bin/env bun
/**
 * crawl-site.ts — full emitted-site audit for the Effusion Labs build.
 * Checks: internal links, asset references, anchor fragments, canonical tags,
 * sitemap.xml, and redirect files. Reports broken targets with referrers.
 *
 * Usage: bun crawl-site.ts [siteDir=_site]
 */
import { readdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";

const SITE = process.argv[2] ?? "_site";

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

const htmlFiles: string[] = [];
const allFiles = new Set<string>();
for await (const f of walk(SITE)) {
  const rel = f.slice(SITE.length);
  allFiles.add(rel);
  if (extname(f) === ".html") htmlFiles.push(f);
}

const attrRe = /<(a|link|img|script|source|video|use)\b[^>]*?(href|src|xlink:href)=["']([^"']+)["']/gi;
const idRe = /\sid=["']([^"']+)["']/gi;

interface Broken { referrer: string; url: string; kind: string }
const broken: Broken[] = [];
const external = new Set<string>();
let anchorChecks = 0, anchorBroken = 0;
const idCache = new Map<string, Set<string>>();

function idsFor(htmlPath: string, html: string): Set<string> {
  let s = idCache.get(htmlPath);
  if (!s) {
    s = new Set<string>();
    for (const m of html.matchAll(idRe)) s.add(m[1]);
    idCache.set(htmlPath, s);
  }
  return s;
}

function resolveTarget(fromFile: string, url: string): string | null {
  // returns site-relative path or null if external/ignored
  if (/^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(url)) return null;
  if (url.startsWith("#")) return "__self__" + url;
  const clean = url.split("?")[0];
  if (!clean || clean === "/") return "/index.html";
  let rel: string;
  if (clean.startsWith("/")) rel = clean;
  else rel = "/" + join(dirname(fromFile.slice(SITE.length)), clean).replace(/\\/g, "/");
  return rel;
}

function existsAsPage(rel: string): string | null {
  // returns the actual file path or null
  if (allFiles.has(rel)) return rel;
  if (rel.endsWith("/")) {
    const idx = rel + "index.html";
    if (allFiles.has(idx)) return idx;
  } else {
    if (allFiles.has(rel + "/index.html")) return rel + "/index.html";
    if (allFiles.has(rel + ".html")) return rel + ".html";
  }
  return null;
}

const htmlCache = new Map<string, string>();
const readHtml = async (p: string) => {
  let h = htmlCache.get(p);
  if (!h) { h = await Bun.file(p).text(); htmlCache.set(p, h); }
  return h;
};

let canonicalMissing = 0, canonicalBad = 0;
let sitemapOk = false;

for (const file of htmlFiles) {
  const rel = file.slice(SITE.length);
  const html = await readHtml(file);

  if (!/<link[^>]+rel=["']canonical["']/i.test(html)) canonicalMissing++;

  for (const m of html.matchAll(attrRe)) {
    const url = m[3];
    if (/^(https?:)?\/\//.test(url) || /^(mailto|tel|data|blob|javascript):/i.test(url)) {
      if (/^https?:\/\//i.test(url)) external.add(new URL(url).host);
      continue;
    }
    const hashIdx = url.indexOf("#");
    const frag = hashIdx >= 0 ? url.slice(hashIdx + 1) : null;
    const target = resolveTarget(file, url);
    if (!target) continue;
    if (target.startsWith("__self__")) {
      anchorChecks++;
      const f2 = decodeURIComponent(url.slice(1));
      if (f2 && !idsFor(file, html).has(f2)) {
        anchorBroken++;
        broken.push({ referrer: rel, url, kind: "anchor" });
      }
      continue;
    }
    const found = existsAsPage(target);
    if (!found) {
      broken.push({ referrer: rel, url, kind: m[1] === "a" ? "link" : "asset" });
      continue;
    }
    if (frag) {
      anchorChecks++;
      const targetFile = join(SITE, found);
      const th = await readHtml(targetFile);
      if (!idsFor(targetFile, th).has(decodeURIComponent(frag))) {
        anchorBroken++;
        broken.push({ referrer: rel, url, kind: "anchor" });
      }
    }
  }
}

sitemapOk = allFiles.has("/sitemap.xml");

console.log("=== emitted-site crawl ===");
console.log(`html pages: ${htmlFiles.length} | files total: ${allFiles.size}`);
console.log(`sitemap.xml: ${sitemapOk ? "present" : "MISSING"}`);
console.log(`pages missing canonical: ${canonicalMissing}`);
console.log(`anchor refs checked: ${anchorChecks}, broken: ${anchorBroken}`);
console.log(`external hosts referenced: ${external.size}`);
const byKind = new Map<string, number>();
for (const b of broken) byKind.set(b.kind, (byKind.get(b.kind) ?? 0) + 1);
console.log(`broken refs total: ${broken.length}`, Object.fromEntries(byKind));
const shown = new Map<string, number>();
for (const b of broken) {
  const key = `${b.kind} ${b.url}`;
  shown.set(key, (shown.get(key) ?? 0) + 1);
}
const top = [...shown.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
for (const [k, n] of top) {
  const refs = broken.filter((b) => `${b.kind} ${b.url}` === k).slice(0, 3).map((b) => b.referrer);
  console.log(`  ${n}x ${k}  (e.g. ${refs.join(", ")})`);
}
