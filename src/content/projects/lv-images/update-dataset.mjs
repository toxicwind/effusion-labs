import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream, fsyncSync, writeFile as writeFileCb } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

import { XMLParser } from "fast-xml-parser";
import pLimit from "p-limit";
import { Agent, setGlobalDispatcher } from "undici";
import bloomPkg from "bloom-filters";
import { gunzipSync } from "node:zlib";
const { ScalableBloomFilter } = bloomPkg;

/* ============================================================
   PATHS & CONFIG
   ============================================================ */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname);
const configDir = path.join(baseDir, "config");
const hostsTxtPath = path.join(configDir, "hosts.txt");

const genDir = path.join(__dirname, "generated", "lv");
const cacheDir = path.join(genDir, "cache");
const robotsDir = path.join(cacheDir, "robots");
const sitemapsDir = path.join(cacheDir, "sitemaps");
const itemsDir = path.join(genDir, "items");
const hostsDir = path.join(genDir, "hosts");

const urlMetaPath = path.join(cacheDir, "urlmeta.json");
const robotsIndexPath = path.join(cacheDir, "robots-index.json");
const allSitemapsIdx = path.join(cacheDir, "allsitemaps.json");
const imgSitemapsIdx = path.join(cacheDir, "imagesitemaps.json");
const docsIndexPath = path.join(cacheDir, "docs-index.json");
const blacklistPath = path.join(hostsDir, "blacklist.json");
const bloomPath = path.join(cacheDir, "seen.bloom.json");
const summaryPath = path.join(genDir, "summary.json");

/* ============================================================
   FLAGS
   ============================================================ */
const argv = new Map(
  process.argv.slice(2).map((x) => {
    const [k, v] = x.includes("=") ? x.split("=") : [x, true];
    return [k, v === undefined ? true : v];
  })
);
const ENABLE_DISCOVERY = !argv.has("--no-discovery");
const RESET_BLACKLIST = argv.has("--reset-blacklist");
const HOST_TTL_HOURS = Number(argv.get("--ttl") ?? 24);
const MAX_HOSTS = argv.has("--max-hosts") ? Number(argv.get("--max-hosts")) : Infinity;
const SEED_LOCALES = (argv.get("--seed-locales") || "eng_US,eng_E1").split(",").map((s) => s.trim()).filter(Boolean);
const EXTRA_XML_GUESS = !argv.has("--no-guess"); // enable heuristic XML guesses
const SAVE_WELLKNOWN_TXT = !argv.has("--no-wellknown"); // save security.txt, ads.txt, humans.txt
const EXCLUDE_LOWER_ENVS = !argv.has("--include-lower-envs");
const LOWER_ENV_PATTERN = /(^|\.)-?ppt\./i;

/* ============================================================
   NET / RUNTIME
   ============================================================ */
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0";
const TIMEOUT_MS = 6000;
const RETRIES = 0;
const GLOBAL_CONCURRENCY = 14;
const PER_HOST_CONCURRENCY = 2;

const STREAM_FSYNC_EVERY = 3000;
const SITEMAP_SHARD_LINES = 25000;
const TERMINAL_4XX = new Set([400, 401, 403, 404, 410, 451]);

setGlobalDispatcher(
  new Agent({
    connections: GLOBAL_CONCURRENCY * 2,
    pipelining: 2,
    keepAliveTimeout: 9000,
    headersTimeout: TIMEOUT_MS + 2000,
  })
);

/* ============================================================
   HELPERS
   ============================================================ */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  allowBooleanAttributes: true,
});
const sha1 = (s) => {
  const h = createHash("sha1");
  h.update(String(s || ""));
  return h.digest("hex");
};
const shortId = (src) => sha1(src).slice(0, 16);
const hostOf = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
};
const safeName = (u) => sha1(u).slice(0, 20);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STRIP_QP = new Set(["wid", "hei", "width", "height", "fmt", "format", "qlt", "quality", "op_sharpen", "bg", "bgc", "resmode"]);
function normalizeImageUrl(u) {
  try {
    const url = new URL(u);
    for (const k of Array.from(url.searchParams.keys())) if (STRIP_QP.has(k)) url.searchParams.delete(k);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    return url.toString();
  } catch {
    return u;
  }
}

// New: robust content handling & sniffing
const isGzipUrl = (url) => /\.gz($|\?)/i.test(url);
const getHeader = (res, name) => (res.headers.get(name) || "").toLowerCase();
function isHtmlLike(text, ct = "") {
  return /html/.test(ct) || /^<!doctype html/i.test(text || "") || /<html[\s>]/i.test(text || "");
}
function isXmlLike(text, ct = "") {
  const t = (text || "").trimStart();
  return /xml/.test(ct) || t.startsWith("<?xml") || /<(?:urlset|sitemapindex)\b/i.test(t);
}
function detectFormat(text, ct = "") {
  if (isHtmlLike(text, ct)) return "html";
  if (isXmlLike(text, ct)) return "xml";
  if (/text\/plain/.test(ct)) return "txt";
  return "bin";
}
function isAccessDeniedHtml(text = "") {
  const t = (text || "").toLowerCase();
  return (
    /unauthorized/.test(t) ||
    /access(?:\s|-)denied/.test(t) ||
    /forbidden/.test(t) ||
    (/sign\s*in|login/.test(t) && /saml|okta|adfs|oauth|auth/.test(t)) ||
    /akamai(?:ghost|error)/.test(t) ||
    /reference\s*#\w{6,}/.test(t)
  );
}
async function readCachedTextAny(url, type) {
  for (const ext of ["xml", "txt", "html", "raw"]) {
    const t = await readCachedText(cachedPathFor(url, type, ext));
    if (t != null) return t;
  }
  return null;
}

/* ============================================================
   STATE
   ============================================================ */
async function ensureDirs() {
  await Promise.all([genDir, cacheDir, robotsDir, sitemapsDir, itemsDir, hostsDir].map((d) => mkdir(d, { recursive: true })));
}
async function loadJson(p, fallback) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}
async function saveJson(p, obj) {
  await writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

/* url meta + blacklist + bloom */
let urlmeta = Object.create(null);
let blacklist = Object.create(null);
const hostStrikes = new Map();
const HOST_FAIL_THRESHOLD = 3;
let seenBloom = null;

/* ============================================================
   HTTP (conditional, gzip-aware, format-aware)
   ============================================================ */
async function timedFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const ums = urlmeta[url];
    const headers = {
      "user-agent": USER_AGENT,
      accept: "application/xml,text/xml;q=0.9,text/plain;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.8",
      ...(ums?.etag ? { "if-none-match": ums.etag } : {}),
      ...(ums?.lastModified ? { "if-modified-since": ums.lastModified } : {}),
      ...(opts.headers || {}),
    };
    const res = await fetch(url, { ...opts, signal: controller.signal, headers });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
function cachedPathFor(url, type, ext = "xml") {
  const h = hostOf(url);
  if (type === "robots") return path.join(robotsDir, `${h}.txt`);
  if (type === "robots-json") return path.join(robotsDir, `${h}.json`);
  if (type === "top-sitemap") return path.join(sitemapsDir, h, `top.${ext}`);
  return path.join(sitemapsDir, h, `${safeName(url)}.${ext}`);
}
async function readCachedText(p) {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function persistText(url, res, text, type, ext = "xml") {
  const p = cachedPathFor(url, type, ext);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, text ?? "", "utf8");
  urlmeta[url] = {
    etag: res.headers.get("etag") || undefined,
    lastModified: res.headers.get("last-modified") || undefined,
    status: res.status,
    savedAt: new Date().toISOString(),
    path: p,
    contentType: res.headers.get("content-type") || undefined,
  };
  return p;
}
async function persistBinary(url, res, buf, type, ext = "bin") {
  const p = cachedPathFor(url, type, ext);
  await mkdir(path.dirname(p), { recursive: true });
  await new Promise((resolve, reject) => writeFileCb(p, buf, (e) => (e ? reject(e) : resolve())));
  urlmeta[url] = {
    etag: res.headers.get("etag") || undefined,
    lastModified: res.headers.get("last-modified") || undefined,
    status: res.status,
    savedAt: new Date().toISOString(),
    path: p,
    contentType: res.headers.get("content-type") || undefined,
  };
  return p;
}
function noteTerminalFail(url, status, reason) {
  const h = hostOf(url);
  if (TERMINAL_4XX.has(status)) {
    hostStrikes.set(h, (hostStrikes.get(h) || 0) + 1);
    urlmeta[url] = { ...(urlmeta[url] || {}), status, savedAt: new Date().toISOString() };
    if (hostStrikes.get(h) >= HOST_FAIL_THRESHOLD) {
      const until = new Date(Date.now() + HOST_TTL_HOURS * 3600 * 1000).toISOString();
      blacklist[h] = { untilISO: until, reason: reason || `terminal_${status}`, strikes: hostStrikes.get(h) };
    }
  }
}
const hostBlacklisted = (host) => {
  const entry = blacklist[host];
  return !!entry && new Date(entry.untilISO) > new Date();
};

// gzip-aware text fetch that persists with correct extensions and format
async function fetchTextCached(url, type = "sitemap") {
  const h = hostOf(url);
  if (hostBlacklisted(h)) return { status: -2, text: null, skipped: "blacklisted" };

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await timedFetch(url);
      if (res.status === 304) {
        const text = await readCachedTextAny(url, type);
        return { status: 304, text, cached: true, contentType: res.headers.get("content-type") || "" };
      }

      const ct = getHeader(res, "content-type");
      const ce = getHeader(res, "content-encoding");

      let buf = Buffer.from(await res.arrayBuffer());
      let text;

      // decide whether to gunzip based on content-encoding or URL
      const shouldGunzip = /\bgzip\b/.test(ce) || isGzipUrl(url) || /application\/x-gzip/.test(ct);
      if (shouldGunzip) {
        try {
          // Save original gzip for forensics as .gz (not xml.gz)
          await persistBinary(url, res, buf, type, "gz");
          buf = gunzipSync(buf);
        } catch {
          // keep a latin1 peek to see what it was
          const fallback = buf.toString("latin1");
          await persistText(url, res, fallback, type, "raw");
          text = fallback;
        }
      }
      if (text == null) text = buf.toString("utf8");

      const fmt = detectFormat(text, ct);
      const ext = fmt === "html" ? "html" : fmt === "txt" ? "txt" : fmt === "xml" ? "xml" : "raw";
      await persistText(url, res, text, type, ext);

      if (TERMINAL_4XX.has(res.status)) noteTerminalFail(url, res.status, `http_${res.status}`);
      return { status: res.status, text, cached: false, contentType: ct, format: fmt };
    } catch (e) {
      if (attempt < RETRIES) continue;
      const cached = await readCachedTextAny(url, type);
      if (cached != null) return { status: -1, text: cached, cached: true, contentType: "" };
      noteTerminalFail(url, -1, "network_error");
      return { status: -1, text: null, error: e?.message || String(e) };
    }
  }
}

/* ============================================================
   robots.txt parsing — capture everything
   ============================================================ */
function parseRobots(text) {
  const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const groups = [];
  let current = { agents: [], rules: [] };
  for (const line of lines) {
    const mUA = line.match(/^user-agent:\s*(.+)$/i);
    if (mUA) {
      if (current.agents.length || current.rules.length) groups.push(current);
      current = { agents: [mUA[1].toLowerCase()], rules: [] };
      continue;
    }
    const mKV = line.match(/^([a-zA-Z-]+):\s*(.+)$/);
    if (mKV) current.rules.push({ k: mKV[1].toLowerCase(), v: mKV[2] });
  }
  if (current.agents.length || current.rules.length) groups.push(current);

  const byAgent = {};
  const KNOWN = new Set(["allow", "disallow", "noindex", "crawl-delay", "sitemap", "host", "clean-param", "request-rate", "visit-time"]);
  for (const g of groups) {
    const agents = g.agents.length ? g.agents : ["*"];
    for (const a of agents) {
      const o = (byAgent[a] ||= {
        allow: [],
        disallow: [],
        noindex: [],
        crawlDelay: null,
        sitemaps: [],
        host: null,
        cleanParam: [],
        requestRate: null,
        visitTime: [],
        unknown: [],
      });
      for (const r of g.rules) {
        const k = r.k;
        if (k === "allow") o.allow.push(r.v);
        else if (k === "disallow") o.disallow.push(r.v);
        else if (k === "noindex") o.noindex.push(r.v);
        else if (k === "crawl-delay" && o.crawlDelay == null) o.crawlDelay = r.v;
        else if (k === "sitemap") o.sitemaps.push(r.v);
        else if (k === "host" && !o.host) o.host = r.v;
        else if (k === "clean-param") o.cleanParam.push(r.v);
        else if (k === "request-rate" && !o.requestRate) o.requestRate = r.v;
        else if (k === "visit-time") o.visitTime.push(r.v);
        else if (!KNOWN.has(k)) o.unknown.push({ k, v: r.v });
      }
    }
  }
  const merged = { allow: [], disallow: [], noindex: [], crawlDelay: null, sitemaps: [], host: null, cleanParam: [], requestRate: null, visitTime: [], unknown: [] };
  if (byAgent["*"]) Object.assign(merged, byAgent["*"]);
  return { byAgent, merged, lines: lines.length };
}

/* ============================================================
   XML helpers
   ============================================================ */
function parseSitemapIndex(xml) {
  try {
    const p = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const obj = p.parse(xml);
    const idx = obj?.sitemapindex;
    const arr = Array.isArray(idx?.sitemap) ? idx.sitemap : idx?.sitemap ? [idx.sitemap] : [];
    return arr.map((it) => it.loc).filter(Boolean);
  } catch {
    return [];
  }
}
function urlsetType(xml) {
  if (!xml) return "none";
  if (/<sitemapindex/i.test(xml)) return "index";
  if (/<urlset[\s\S]*?<image:/i.test(xml)) return "image";
  if (/<urlset[\s\S]*?<url>/i.test(xml)) return "page";
  return "other";
}
function* iterSitemapItems(xmlText) {
  const root = parser.parse(xmlText);
  const urlset = root.urlset || root.sitemapindex || root;
  const urls = Array.isArray(urlset.url) ? urlset.url : urlset.url ? [urlset.url] : [];
  for (const entry of urls) {
    const pageUrl = entry?.loc || "";
    let images = entry?.image || entry?.["image:image"] || [];
    if (!Array.isArray(images)) images = [images];
    for (const image of images) {
      if (!image) continue;
      const raw = image.loc || image["image:loc"] || image.url || null;
      if (!raw) continue;
      const src = normalizeImageUrl(raw);
      const title = image.title || image["image:title"] || image.caption || image["image:caption"] || "";
      const license = image.license || image["image:license"] || "";
      yield { src, title, license, pageUrl };
    }
  }
}
const localeFromUrl = (u) => {
  try {
    return new URL(u).pathname.match(/\/sitemap\/([^\/]+)\//)?.[1] ?? "";
  } catch {
    return "";
  }
};

/* ============================================================
   DISCOVERY per host (robots-aware + seeds + variants + recursion)
   ============================================================ */
const TOP_XML_VARIANTS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemapindex.xml",
  "/sitemap/sitemap.xml"
];
const EXTRA_XML_VARIANTS = [
  "/news-sitemap.xml",
  "/video-sitemap.xml",
  "/image-sitemap.xml",
  "/feed.xml",
  "/rss.xml",
  "/atom.xml",
  "/sitemap-1.xml"
];
const WELLKNOWN_TXT = ["/robots.txt", "/ads.txt", "/humans.txt", "/.well-known/security.txt"];

async function discoverHost(host) {
  if (hostBlacklisted(host)) return { host, robots: null, sitemaps: [], docs: [] };

  const discovered = new Set();
  const docs = []; // every xml/txt/html we save for this host
  const challenges = { html: 0 };

  // helper to record docs index entries
  function recordDoc(u, kind, savedPath, status, contentType, sizeBytes, format) {
    if (kind === "html") challenges.html++;
    docs.push({ url: u, kind, savedPath, status, contentType, format: format || null, size: sizeBytes ?? null });
  }

  // Try well-known TXT (saved regardless of robots)
  if (SAVE_WELLKNOWN_TXT) {
    for (const pth of WELLKNOWN_TXT) {
      const url = `https://${host}${pth}`;
      const res = await fetchTextCached(url, "robots"); // reuse robots cache bucket for txt/html
      if (res.text) {
        const ext = urlmeta[url]?.path?.split(".").pop() || (pth.endsWith(".txt") ? "txt" : "txt");
        recordDoc(url, ext === "html" ? "html" : "txt", urlmeta[url]?.path || cachedPathFor(url, "robots", ext), res.status, res.contentType || "", undefined, res.format || null);
      }
    }
  }

  // robots.txt (for hints)
  const robotsURL = `https://${host}/robots.txt`;
  const robotsFetch = await fetchTextCached(robotsURL, "robots");
  const robotsFmt = robotsFetch.format || detectFormat(robotsFetch.text, robotsFetch.contentType);
  let robotsParsed = parseRobots(robotsFetch.text || "");
  const robotsJsonPath = cachedPathFor(robotsURL, "robots-json", "json");

  // record as doc (txt or html)
  recordDoc(
    robotsURL,
    urlmeta[robotsURL]?.path?.endsWith(".html") ? "html" : "txt",
    urlmeta[robotsURL]?.path || cachedPathFor(robotsURL, "robots", robotsFmt === "html" ? "html" : "txt"),
    robotsFetch.status,
    robotsFetch.contentType || (robotsFmt === "html" ? "text/html" : "text/plain"),
    undefined,
    robotsFetch.format || null
  );

  // (1-3) New: mark invalid robots if HTML or denied-like body; strike & maybe blacklist; then abort discovery
  let robotsInvalid = false;
  if (robotsFmt !== "txt") robotsInvalid = true;
  if (robotsFmt === "html" && isAccessDeniedHtml(robotsFetch.text)) {
    robotsInvalid = true;
    hostStrikes.set(host, (hostStrikes.get(host) || 0) + 1);
    if (hostStrikes.get(host) >= HOST_FAIL_THRESHOLD) {
      const until = new Date(Date.now() + HOST_TTL_HOURS * 3600 * 1000).toISOString();
      blacklist[host] = { untilISO: until, reason: "robots_html_denied", strikes: hostStrikes.get(host) };
    }
  }

  // write robots parsed JSON with invalid flag
  await writeFile(robotsJsonPath, JSON.stringify({ ...robotsParsed, _invalid: robotsInvalid }, null, 2) + "\n", "utf8");

  // If robots invalid, abort discovery for this host (return docs only)
  if (robotsInvalid) {
    const robotsIndexEntry = {
      host,
      robotsTxtPath: urlmeta[robotsURL]?.path || cachedPathFor(robotsURL, "robots", robotsFmt === "html" ? "html" : "txt"),
      robotsJsonPath,
      sitemapsInRobots: [],
      parsed: robotsParsed,
      challenges,
      invalid: true,
    };
    return { host, robots: robotsIndexEntry, sitemaps: [], docs };
  }

  // Sitemaps referenced in robots
  for (const u of robotsParsed.merged.sitemaps || []) if (u) discovered.add(u);

  // Top-level xml variants
  for (const v of TOP_XML_VARIANTS) discovered.add(`https://${host}${v}`);

  // LV-seed sitemaps for just a couple locales to open doors
  for (const loc of SEED_LOCALES) {
    for (const t of ["image", "product", "content", "catalog"]) {
      discovered.add(`https://${host}/content/louisvuitton/sitemap/${loc}/sitemap-${t}.xml`);
    }
  }

  // Heuristic extras (bounded list)
  if (EXTRA_XML_GUESS) {
    for (const v of EXTRA_XML_VARIANTS) discovered.add(`https://${host}${v}`);
  }

  // From robots rules, harvest explicit *.xml under /sitemap paths only (reduce noise)
  for (const a of Object.values(robotsParsed.byAgent || {})) {
    for (const rule of [...a.allow, ...a.disallow, ...a.noindex]) {
      if (!rule || /[\*\?\[\]]/.test(rule)) continue;
      try {
        const uu = rule.startsWith("http") ? rule : `https://${host}${rule.startsWith("/") ? "" : "/"}${rule}`;
        if (/\/sitemap/i.test(uu) && /\.xml(\.gz)?($|\?)/i.test(uu)) discovered.add(uu);
        if (/\.txt($|\?)/i.test(uu)) {
          const res = await fetchTextCached(uu, "robots");
          if (res.text) {
            const ext = urlmeta[uu]?.path?.split(".").pop() || "txt";
            recordDoc(uu, ext === "html" ? "html" : "txt", urlmeta[uu]?.path || cachedPathFor(uu, "robots", ext), res.status, res.contentType || "", undefined, res.format || null);
          }
        }
      } catch { }
    }
  }

  // expand sitemap indexes recursively; also save all XMLs we touch
  const queue = [...discovered];
  const visited = new Set();
  const expanded = new Set();

  while (queue.length) {
    const u = queue.shift();
    if (visited.has(u)) continue;
    visited.add(u);

    const res = await fetchTextCached(u, "sitemap");
    if (!res.text) continue;

    // record document with detected format
    const ext = urlmeta[u]?.path?.split(".").pop() || "xml";
    const kind = ext === "html" ? "html" : ext === "txt" ? "txt" : "xml";
    const savedPath = urlmeta[u]?.path || cachedPathFor(u, kind === "xml" ? "sitemap" : "robots", ext);
    recordDoc(u, kind, savedPath, res.status, res.contentType || (kind === "txt" ? "text/plain" : ""), undefined, res.format || null);

    // Only expand XML sitemap indexes
    if ((res.format || detectFormat(res.text, res.contentType)) === "xml" && urlsetType(res.text) === "index") {
      expanded.add(u);
      for (const child of parseSitemapIndex(res.text)) {
        if (!visited.has(child)) queue.push(child);
      }
    }
  }

  // Infer locales and probe those sitemap types too (only if we saw life)
  const inferred = new Set([...visited].map(localeFromUrl).filter(Boolean));
  for (const loc of inferred) {
    for (const t of ["image", "product", "content", "catalog"]) {
      const u = `https://${host}/content/louisvuitton/sitemap/${loc}/sitemap-${t}.xml`;
      if (visited.has(u)) continue;
      const r = await fetchTextCached(u, "sitemap");
      if (r.text) {
        const ext = urlmeta[u]?.path?.split(".").pop() || "xml";
        recordDoc(u, ext === "html" ? "html" : "xml", urlmeta[u]?.path || cachedPathFor(u, "sitemap", ext), r.status, r.contentType || "application/xml", undefined, r.format || null);
        if ((r.format || detectFormat(r.text, r.contentType)) === "xml" && urlsetType(r.text) === "index") {
          for (const child of parseSitemapIndex(r.text))
            if (!visited.has(child)) {
              const cr = await fetchTextCached(child, "sitemap");
              if (cr.text) {
                const cext = urlmeta[child]?.path?.split(".").pop() || "xml";
                recordDoc(child, cext === "html" ? "html" : "xml", urlmeta[child]?.path || cachedPathFor(child, "sitemap", cext), cr.status, cr.contentType || "application/xml", undefined, cr.format || null);
              }
            }
        }
      }
    }
  }

  // Partition image-first for crawling (XML only)
  const imageFirst = [];
  const rest = [];
  for (const u of visited) {
    const r = await readCachedTextAny(u, "sitemap");
    const fmt = detectFormat(r || "", "");
    const kind = fmt === "xml" ? urlsetType(r || "") : "other";
    if (kind === "image") imageFirst.push(u);
    else rest.push(u);
  }

  const robotsIndexEntry = {
    host,
    robotsTxtPath: urlmeta[robotsURL]?.path || cachedPathFor(robotsURL, "robots", robotsFmt === "html" ? "html" : "txt"),
    robotsJsonPath,
    sitemapsInRobots: robotsParsed.merged.sitemaps || [],
    parsed: robotsParsed,
    challenges,
    invalid: false,
  };

  return { host, robots: robotsIndexEntry, sitemaps: [...new Set([...imageFirst, ...rest])], docs };
}

/* ============================================================
   MAIN — discover, save everything XML/TXT/HTML, then crawl image items
   ============================================================ */
async function main() {
  await ensureDirs();

  const hostsTxtRaw = (await readFile(hostsTxtPath, "utf8")).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const hostsTxt = EXCLUDE_LOWER_ENVS ? hostsTxtRaw.filter((h) => !LOWER_ENV_PATTERN.test(h)) : hostsTxtRaw;

  urlmeta = await loadJson(urlMetaPath, Object.create(null));
  blacklist = RESET_BLACKLIST ? Object.create(null) : await loadJson(blacklistPath, Object.create(null));
  for (const [h, v] of Object.entries(blacklist)) if (new Date(v.untilISO) <= new Date()) delete blacklist[h];

  const existingBloom = await loadJson(bloomPath, null);
  seenBloom = existingBloom ? ScalableBloomFilter.fromJSON(existingBloom) : new ScalableBloomFilter(200_000, 0.01);

  // DISCOVERY
  const discoveryHosts = (MAX_HOSTS === Infinity ? hostsTxt : hostsTxt.slice(0, MAX_HOSTS)).filter((h) => !hostBlacklisted(h));
  const robotsIndex = {};
  const allSitemaps = {};
  const docsIndex = {};
  const sitemapSet = new Set();

  if (ENABLE_DISCOVERY) {
    console.log(`→ discovery across ${discoveryHosts.length} hosts (robots-aware + seeds + variants)`);
    const batchSize = 8;
    for (let off = 0; off < discoveryHosts.length; off += batchSize) {
      const batch = discoveryHosts.slice(off, off + batchSize).filter((h) => !hostBlacklisted(h));
      process.stdout.write(`   • batch ${Math.floor(off / batchSize) + 1}: ${batch.join(", ")}\n`);
      const results = await Promise.all(batch.map((h) => discoverHost(h)));
      for (const r of results) {
        if (r.robots) robotsIndex[r.host] = r.robots;
        allSitemaps[r.host] = r.sitemaps;
        docsIndex[r.host] = r.docs;
        for (const u of r.sitemaps) sitemapSet.add(u);
      }
      if (off + batchSize < discoveryHosts.length) await sleep(150);
    }
  }

  await saveJson(robotsIndexPath, robotsIndex);
  await saveJson(allSitemapsIdx, allSitemaps);
  await saveJson(docsIndexPath, docsIndex);

  const imageOnly = Object.fromEntries(Object.entries(allSitemaps).map(([host, list]) => [host, list.filter((u) => /image/i.test(u))]));
  await saveJson(imgSitemapsIdx, imageOnly);

  const sitemapUrls = [...sitemapSet].sort();
  console.log(`→ Total sitemap candidates: ${sitemapUrls.length}`);

  // shard writer (image items)
  const ts = new Date().toISOString().replace(/[:.]/g, "");
  let shardIndex = 0,
    shardLines = 0,
    shardItems = 0,
    shardStream = null;
  async function openShard() {
    shardIndex++;
    shardLines = 0;
    const shardPath = path.join(itemsDir, `shard-${ts}-${String(shardIndex).padStart(3, "0")}.ndjson`);
    shardStream = createWriteStream(shardPath, { flags: "w" });
    await once(shardStream, "open");
    return shardPath;
  }
  await openShard();
  const writeLine = async (line) => {
    if (!shardStream.write(line + "\n")) await once(shardStream, "drain");
    shardLines++;
    shardItems++;
    if (shardItems % STREAM_FSYNC_EVERY === 0 && typeof shardStream.fd === "number") {
      try {
        fsyncSync(shardStream.fd);
      } catch { }
    }
    if (shardLines >= SITEMAP_SHARD_LINES) {
      await new Promise((r) => shardStream.end(r));
      await openShard();
    }
  };

  // rollups
  const pagesSet = new Set();
  const localeCounts = new Map();
  const hostCounts = new Map();
  const sitemapsLog = [];
  const failures = [];

  // priority: image sitemaps first
  const prioritized = sitemapUrls.sort((a, b) => {
    const ia = /image/i.test(a) ? 0 : 1;
    const ib = /image/i.test(b) ? 0 : 1;
    return ia - ib || a.localeCompare(b);
  });

  const globalLimit = pLimit(GLOBAL_CONCURRENCY);
  const hostLimiters = new Map();
  const limFor = (h) => (hostLimiters.has(h) ? hostLimiters.get(h) : hostLimiters.set(h, pLimit(PER_HOST_CONCURRENCY)).get(h));
  const localeOf = (u) => {
    try {
      return new URL(u).pathname.match(/\/sitemap\/([^\/]+)\//)?.[1] ?? "";
    } catch {
      return "";
    }
  };

  let totalItems = 0;

  await Promise.all(
    prioritized.map((u) => {
      const h = hostOf(u);
      return globalLimit(() =>
        limFor(h)(async () => {
          if (hostBlacklisted(h)) {
            failures.push({ url: u, host: h, locale: localeOf(u), error: "blacklisted" });
            return;
          }
          const res = await fetchTextCached(u, "sitemap");
          const status = res.status;
          if (status > 0 && TERMINAL_4XX.has(status)) {
            failures.push({ url: u, host: h, locale: localeOf(u), error: `HTTP ${status}` });
            return;
          }
          if (!res.text) {
            failures.push({ url: u, host: h, locale: localeOf(u), error: res.error || "no_response" });
            return;
          }

          const format = res.format || detectFormat(res.text, res.contentType);
          if (format !== "xml") {
            sitemapsLog.push({ url: u, host: h, kind: "non-xml", ok: false, imageCount: 0 });
            return;
          }

          const kind = urlsetType(res.text);
          let count = 0;
          if (kind === "image") {
            for (const it of iterSitemapItems(res.text)) {
              const id = shortId(it.src);
              if (seenBloom.has(id)) continue;
              seenBloom.add(id);
              const rec = { id, src: it.src, title: it.title || "", license: it.license || "", page: it.pageUrl || "", host: h, locale: localeOf(u), sitemap: u };
              await writeLine(JSON.stringify(rec));
              if (rec.page) pagesSet.add(rec.page);
              localeCounts.set(rec.locale, (localeCounts.get(rec.locale) || 0) + 1);
              hostCounts.set(h, (hostCounts.get(h) || 0) + 1);
              count++;
              totalItems++;
            }
          }
          sitemapsLog.push({ url: u, host: h, kind, ok: kind === "image" || kind === "page" || kind === "index", imageCount: count });
        })
      );
    })
  );

  await new Promise((resolve) => shardStream.end(resolve));

  // persist state
  await saveJson(urlMetaPath, urlmeta);
  await saveJson(blacklistPath, blacklist);
  await saveJson(bloomPath, seenBloom.saveAsJSON());

  // summary
  const sortObj = (m) => Object.fromEntries([...m.entries()].sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1])));
  const summary = {
    version: 11,
    generatedAt: new Date().toISOString(),
    config: {
      discovery: ENABLE_DISCOVERY,
      timeoutsMs: TIMEOUT_MS,
      retries: RETRIES,
      globalConcurrency: GLOBAL_CONCURRENCY,
      perHostConcurrency: PER_HOST_CONCURRENCY,
      shardLines: SITEMAP_SHARD_LINES,
      fsyncEvery: STREAM_FSYNC_EVERY,
      seedLocales: SEED_LOCALES,
      extraXmlGuess: EXTRA_XML_GUESS,
      wellKnownTxt: SAVE_WELLKNOWN_TXT,
      excludeLowerEnvs: EXCLUDE_LOWER_ENVS,
    },
    inputs: { hostsTxt: path.relative(process.cwd(), hostsTxtPath) },
    outputs: {
      itemsDir: path.relative(process.cwd(), itemsDir),
      robotsIndex: path.relative(process.cwd(), robotsIndexPath),
      allSitemapsIndex: path.relative(process.cwd(), allSitemapsIdx),
      imageSitemapsIndex: path.relative(process.cwd(), imgSitemapsIdx),
      docsIndex: path.relative(process.cwd(), docsIndexPath),
      urlmeta: path.relative(process.cwd(), urlMetaPath),
      blacklist: path.relative(process.cwd(), blacklistPath),
      bloom: path.relative(process.cwd(), bloomPath),
      summary: path.relative(process.cwd(), summaryPath),
    },
    totals: {
      items: totalItems,
      pages: pagesSet.size,
      byLocale: sortObj(localeCounts),
      byHost: sortObj(hostCounts),
      sitemaps: sitemapsLog.length,
      ok: sitemapsLog.filter((s) => s.ok).length,
      failures: failures.length + sitemapsLog.filter((s) => s.ok === false).length,
    },
    sitemaps: sitemapsLog.sort((a, b) => (a.host || "").localeCompare(b.host || "") || a.url.localeCompare(b.url)),
  };
  await saveJson(summaryPath, summary);

  console.log(`\nSaved summary → ${path.relative(process.cwd(), summaryPath)}`);
  console.log(
    `Items: ${summary.totals.items.toLocaleString()} • Pages: ${summary.totals.pages.toLocaleString()} • OK: ${summary.totals.ok}/${summary.totals.sitemaps} • Failures: ${summary.totals.failures}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});