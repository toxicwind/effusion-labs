// update-dataset.mjs — Playwright-backed fetches + item lifecycle
//
// - Uses Playwright context.request for ALL network calls.
// - XML profile headers: accept: "application/xml,text/xml;q=0.9,*/*;q=0.2"
// - robots profile headers: accept: "text/plain,*/*;q=0.3"
// - No HEAD requests (your debugger showed HEAD=403 while GET=200).
// - If robots.txt returns HTML/403/“access denied”, we retry once via page.goto.
// - Gzip sniff/handling for .xml.gz and gzip-encoded responses.
// - Keeps your items-meta / runs-history lifecycle logic intact.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { once } from "node:events";
import { gunzipSync } from "node:zlib";

import { XMLParser } from "fast-xml-parser";
import pLimit from "p-limit";
import pkg from "bloom-filters";
const { ScalableBloomFilter } = pkg;

import { chromium } from "playwright";
import { resolveChromium } from "../../../../tools/resolve-chromium.mjs";
import { decodeRobots } from "./robots_decode.mjs";
import { bundleDataset } from "../../../../tools/lv-images/bundle-lib.mjs";

/* ============================================================
   PATHS & CONFIG
   ============================================================ */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname);

const genDir = path.join(__dirname, "generated", "lv");
const cacheDir = path.join(genDir, "cache");
const itemsDir = path.join(genDir, "items");

const robotsDir = path.join(cacheDir, "robots");
const urlmetaPath = path.join(cacheDir, "urlmeta.json");

const itemsMetaPath = path.join(genDir, "items-meta.json");
const runsHistoryPath = path.join(genDir, "runs-history.json");
const allImagesPath = path.join(genDir, "all-images.json");
const allProductsPath = path.join(genDir, "all-products.json");

const hostsTxtPath = path.join(baseDir, "./config/hosts.txt");

const bloomPath = path.join(cacheDir, "seen.bloom.json");
const summaryPath = path.join(genDir, "summary.json");

const posixify = (value) => value.split(path.sep).join("/");
const toRelativeCachePath = (inputPath) => {
  if (!inputPath) return "";
  const normalized = String(inputPath).trim();
  if (!normalized) return "";
  const unixified = normalized.replace(/\\/g, "/");
  const marker = "/generated/lv/";
  const idx = unixified.indexOf(marker);
  if (idx !== -1) {
    const tail = unixified.slice(idx + marker.length).replace(/^\/+/, "");
    if (tail) return tail;
  }
  const absolute = path.isAbsolute(normalized)
    ? normalized
    : path.resolve(genDir, normalized);
  const relative = path.relative(genDir, absolute);
  if (!relative || relative.startsWith("..")) {
    return posixify(normalized);
  }
  return posixify(relative);
};

/* ============================================================
   STATELESS HELPERS & UTILITIES
   ============================================================ */
const sha1 = (s) => createHash("sha1").update(String(s || "")).digest("hex");
const shortId = (src) => sha1(src).slice(0, 16);
const hostOf = (u) => { try { return new URL(u).host; } catch { return ""; } };
const isGzipMagic = (buf) => Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
const saveJson = (p, obj) => writeFile(p, JSON.stringify(obj, null, 2), "utf8");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0";
const TIMEOUT_MS = 15000;

const isXmlLike = (text) => {
  const t = (text || "").trimStart();
  return t.startsWith("<?xml") || /<(urlset|sitemapindex)\b/i.test(t);
};
const isHtmlLike = (text) =>
  /^<!doctype html/i.test(text || "") || /<html[\s>]/i.test(text || "");
const detectExtension = (text, ct = "") => {
  if (/xml/i.test(ct) || isXmlLike(text)) return "xml";
  if (/html/i.test(ct) || isHtmlLike(text)) return "html";
  if (/text\/plain/i.test(ct)) return "txt";
  return "txt";
};

const parseRobotsForSitemaps = (text) =>
  (text.match(/^sitemap:\s*(.+)$/gim) || []).map((line) =>
    line.replace(/^sitemap:\s*/i, "").trim()
  );

const isSitemapIndex = (xml) => /<sitemapindex\b/i.test(xml);

function* iterSitemapItems(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
  });
  let root;
  try {
    root = parser.parse(xmlText);
  } catch {
    root = {};
  }
  let entries = [];
  if (root?.urlset?.url) {
    entries = Array.isArray(root.urlset.url) ? root.urlset.url : [root.urlset.url];
  } else if (root?.urlset) {
    entries = [root.urlset];
  } else {
    const locRegex = /<loc>(.*?)<\/loc>/gi;
    let match;
    while ((match = locRegex.exec(xmlText))) {
      const url = match[1].trim();
      if (url) yield { src: url, pageUrl: url, lastMod: "", title: "", itemType: "page" };
    }
    return;
  }
  for (const entry of entries) {
    const pageUrl = typeof entry?.loc === "string" ? entry.loc : (entry?.loc?.["#text"] || "");
    const lastMod = entry?.lastmod || "";
    let rawImages = entry?.image || entry?.["image:image"] || entry?.["image"];
    const images = rawImages ? (Array.isArray(rawImages) ? rawImages : [rawImages]) : [];
    if (images.length) {
      for (const img of images) {
        let src = img?.loc || img?.["image:loc"] || "";
        if (src && typeof src === "object" && src["#text"]) src = String(src["#text"]).trim();
        let title = img?.title || img?.caption || img?.["image:title"] || img?.["image:caption"] || "";
        if (title && typeof title === "object" && title["#text"]) title = String(title["#text"]).trim();
        if (src) yield { src, pageUrl, lastMod, title, itemType: "image" };
      }
    } else if (pageUrl) {
      yield { src: pageUrl, pageUrl, lastMod, title: "", itemType: "page" };
    }
  }
}

// cache helper: returns/accepts absolute paths
const cache = {
  pathFor: (url, ext = "cache") => path.join(cacheDir, hostOf(url), `${sha1(url)}.${ext}`),
  async read(url) {
    for (const ext of ["xml", "html", "txt", "cache"]) {
      const p = this.pathFor(url, ext);
      try { return { text: await readFile(p, "utf8"), path: p }; } catch { }
    }
    return null;
  },
  async write(url, content, ct) {
    const ext = detectExtension(content, ct);
    const p = this.pathFor(url, ext);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content, "utf8");
    return p;
  },
};

class NdjsonWriter {
  constructor(dir) {
    this.dir = dir;
    this.shardIndex = 0;
    this.shardLines = 0;
    this.totalItems = 0;
    this.stream = null;

    // Single-file write gate: ensures only one write hits the stream at a time.
    this._queue = Promise.resolve();
  }

  async _openShard() {
    if (this.stream) await new Promise((r) => this.stream.end(r));
    this.shardIndex++;
    this.shardLines = 0;
    const ts = new Date().toISOString().replace(/[.:]/g, "");
    const shardPath = path.join(
      this.dir,
      `shard-${ts}-${String(this.shardIndex).padStart(3, "0")}.ndjson`
    );

    this.stream = createWriteStream(shardPath, { flags: "w" });
    // Remove listener ceiling to avoid benign warnings under heavy churn.
    this.stream.setMaxListeners(0);
    await once(this.stream, "open");
  }

  // Internal helper: perform a single physical write with backpressure handling.
  async _writeLine(line) {
    if (!this.stream || this.shardLines >= 25000) await this._openShard();

    // Try a direct write first. If it returns false, wait exactly one drain.
    if (this.stream.write(line)) {
      this.shardLines++;
      this.totalItems++;
      return;
    }

    // Backpressure path: wait for 'drain' once, then account the line.
    await once(this.stream, "drain");
    this.shardLines++;
    this.totalItems++;
  }

  // Public API: queue writes so only one hits the stream at a time.
  async write(item) {
    const line = JSON.stringify(item) + "\n";
    this._queue = this._queue.then(() => this._writeLine(line));
    return this._queue;
  }

  async close() {
    // Flush any queued writes before closing.
    await this._queue;
    if (this.stream) await new Promise((r) => this.stream.end(r));
  }
}


/* ============================================================
   Playwright lifecycle (shared)
   ============================================================ */
let pwBrowser = null;
let pwCtx = null;

async function startPlaywright() {
  pwBrowser = await chromium.launch({
    headless: true,
    executablePath: resolveChromium(),
    args: [
      "--disable-http-cache",
      "--disk-cache-size=0",
      "--media-cache-size=0",
      "--disable-application-cache",
      "--disable-offline-auto-reload",
      "--disable-background-networking",
    ],
  });
  pwCtx = await pwBrowser.newContext({
    userAgent: USER_AGENT,
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    extraHTTPHeaders: {
      "accept-language": "en-US,en;q=0.8",
      "cache-control": "no-store, max-age=0, must-revalidate",
      pragma: "no-cache",
      expires: "0",
    },
  });
  await pwCtx.setDefaultNavigationTimeout(TIMEOUT_MS);
  await pwCtx.setDefaultTimeout(TIMEOUT_MS);
}
async function stopPlaywright() {
  try { await pwCtx?.close(); } catch { }
  try { await pwBrowser?.close(); } catch { }
}

/* ============================================================
   THE CRAWLER CLASS
   ============================================================ */
class Crawler {
  constructor(config) {
    this.config = config;
    this.limiter = pLimit(config.concurrency);
    this.seenBloom = config.initialBloom || new ScalableBloomFilter();
  }

  _headersFor(url) {
    const isRobots = /\/robots\.txt(?:$|\?)/i.test(url);
    return isRobots
      ? {
        "user-agent": USER_AGENT,
        accept: "text/plain,*/*;q=0.3",
        "accept-language": "en-US,en;q=0.8",
        "cache-control": "no-store, max-age=0, must-revalidate",
        pragma: "no-cache",
        expires: "0",
        "if-modified-since": "Thu, 01 Jan 1970 00:00:00 GMT",
      }
      : {
        "user-agent": USER_AGENT,
        accept: "application/xml,text/xml;q=0.9,*/*;q=0.2",
        "accept-language": "en-US,en;q=0.8",
        "cache-control": "no-store, max-age=0, must-revalidate",
        pragma: "no-cache",
        expires: "0",
        "if-modified-since": "Thu, 01 Jan 1970 00:00:00 GMT",
      };
  }

  _looksDenied(text = "") {
    const t = (text || "").toLowerCase();
    return (
      /access[\s-]denied/.test(t) ||
      /unauthorized/.test(t) ||
      /forbidden/.test(t) ||
      /you don't have permission/.test(t) ||
      /akamai/i.test(text) ||
      /reference\s*#\w+/i.test(text)
    );
  }

  async _pwGet(url, { type: _type = "auto" } = {}) {
    // 1) Primary: context.request.get with working headers
    const headers = this._headersFor(url);
    let resp = await pwCtx.request.get(url, { headers, timeout: TIMEOUT_MS });
    let status = resp.status();
    let hdrs = resp.headers();
    let body = await resp.body();

    // gzip?
    const ce = (hdrs["content-encoding"] || "").toLowerCase();
    const ct = (hdrs["content-type"] || "").toLowerCase();
    const gzHeader = /\bgzip\b/.test(ce) || /application\/x-gzip|gzip/i.test(ct);
    const gzMagic = isGzipMagic(body);
    if (gzHeader || gzMagic) {
      try { body = gunzipSync(body); } catch { }
    }
    let text = body.toString("utf8");

    // 2) robots fallback: if we got HTML/403/denied, try real page once
    const isRobots = /\/robots\.txt(?:$|\?)/i.test(url);
    if (isRobots && (status >= 400 || isHtmlLike(text) || this._looksDenied(text))) {
      const page = await pwCtx.newPage();
      try {
        const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
        status = r ? r.status() : status;
        hdrs = r ? r.headers() : hdrs;
        body = r ? await r.body() : body;
        const ce2 = (hdrs["content-encoding"] || "").toLowerCase();
        const ct2 = (hdrs["content-type"] || "").toLowerCase();
        const gz2 = /\bgzip\b/.test(ce2) || /application\/x-gzip|gzip/i.test(ct2) || isGzipMagic(body);
        if (gz2) { try { body = gunzipSync(body); } catch { } }
        text = body.toString("utf8");
      } finally {
        await page.close().catch(() => { });
      }
    }

    // Persist cache
    const savedPath = await cache.write(url, text, hdrs["content-type"] || "");
    this.config.recordUrlMeta?.(url, savedPath, String(status), hdrs["content-type"] || "");
    return { status, text, headers: hdrs, cachePath: savedPath };
  }

  async _fetchAndCache(url, { forceRefresh = false } = {}) {
    const cached = forceRefresh ? null : await cache.read(url).catch(() => null);
    try {
      const res = await this._pwGet(url);
      return {
        text: res.text,
        fromCache: false,
        cachePath: res.cachePath,
        status: String(res.status),
        contentType: res.headers["content-type"] || "",
      };
    } catch (error) {
      if (!forceRefresh && cached) {
        console.warn(`[lv-images] Network error for ${url}; using cached copy (${error?.message || error}).`);
        return {
          text: cached.text,
          fromCache: true,
          cachePath: cached.path,
          status: "",
          contentType: "",
          error: error?.message || String(error),
        };
      }
      return { error: error?.message || String(error) };
    }
  }

  async _discoverHost(host) {
    console.log(`\n🕵️ Discovering sitemaps for ${host}...`);
    const robotsUrl = `https://${host}/robots.txt`;
    const robotsRes = await this._fetchAndCache(robotsUrl, { forceRefresh: true });

    if (robotsRes.text) {
      const robotsTxtFile = path.join(robotsDir, `${host}.txt`);
      await writeFile(robotsTxtFile, robotsRes.text, "utf8");
      const decoded = decodeRobots(robotsRes.text, `https://${host}`);
      const robotsJsonFile = path.join(robotsDir, `${host}.json`);
      await writeFile(robotsJsonFile, JSON.stringify(decoded, null, 2), "utf8");
    }

    const sitemapsFromRobots = robotsRes.text ? parseRobotsForSitemaps(robotsRes.text) : [];
    const foundUrls = new Set(sitemapsFromRobots);
    ["/sitemap.xml", "/sitemap_index.xml"].forEach((v) => foundUrls.add(`https://${host}${v}`));

    const finalSitemaps = new Set();
    const queue = [...foundUrls];
    const visited = new Set();

    while (queue.length > 0) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      const res = await this._fetchAndCache(url, { forceRefresh: true });
      if (!res?.text || !isXmlLike(res.text)) continue;

      if (isSitemapIndex(res.text)) {
        const childUrls = (res.text.match(/<loc>(.*?)<\/loc>/g) || []).map((s) => s.replace(/<\/?loc>/g, "").trim());
        childUrls.forEach((u) => { if (!visited.has(u)) queue.push(u); });
      } else {
        finalSitemaps.add(url);
      }
    }

    console.log(`   • ${host}: ${finalSitemaps.size} content sitemaps`);
    return { host, sitemaps: [...finalSitemaps], robotsInfo: { url: robotsUrl, found: sitemapsFromRobots.length > 0 } };
  }

  async _processSitemap(url, writer, updateItemMeta) {
    const res = await this._fetchAndCache(url, { forceRefresh: true });
    if (!res?.text) {
      const reason = res?.error ? ` (${res.error})` : "";
      console.log(`  - ⚠️ Failed to refresh ${path.basename(url)}${reason}`);
      return { processed: 0, newItems: 0, duplicates: 0 };
    }
    if (res.fromCache) {
      console.log(`  - ⚠️ Using cached copy for ${path.basename(url)} (network fallback)`);
    }

    const text = res.text;

    let processedCount = 0;
    let newItemCount = 0;
    let duplicateCount = 0;
    for (const item of iterSitemapItems(text)) {
      processedCount++;
      const id = shortId(item.src);
      const dupOf = updateItemMeta(id, {
        src: item.src,
        pageUrl: item.pageUrl,
        lastMod: item.lastMod || item.lastmod || "",
        title: item.title || "",
        host: hostOf(url),
        sitemap: url,
        itemType: item.itemType || "image",
      });
      const alreadySeen = this.seenBloom.has(id);
      const isDuplicate = Boolean(dupOf) || alreadySeen;
      if (!isDuplicate) {
        await writer.write({ ...item, id, host: hostOf(url), sitemap: url });
        this.seenBloom.add(id);
        newItemCount++;
      } else {
        duplicateCount++;
      }
    }
    console.log(
      `  - Parsed ${processedCount} items from ${path.basename(url)} (new: ${newItemCount}, duplicates: ${duplicateCount})`,
    );
    return { processed: processedCount, newItems: newItemCount, duplicates: duplicateCount };
  }

  async run(hosts, updateItemMeta) {
    console.log(`\n🔍 Starting discovery for ${hosts.length} hosts...`);
    const discoveryResults = await Promise.all(
      hosts.map((host) => this.limiter(() => this._discoverHost(host)))
    );

    // Save per-host sitemap lists
    await Promise.all(
      discoveryResults.filter(Boolean).map(async (result) => {
        const hostCacheDir = path.join(cacheDir, result.host);
        await mkdir(hostCacheDir, { recursive: true });
        const indexPath = path.join(hostCacheDir, "_index.json");
        const metadata = {
          host: result.host,
          discoveredAt: new Date().toISOString(),
          robotsInfo: result.robotsInfo,
          sitemaps: result.sitemaps,
        };
        await saveJson(indexPath, metadata);
      })
    );

    // Process sitemaps
    const sitemapQueue = discoveryResults.filter(Boolean).flatMap((r) => r.sitemaps);
    console.log(`\n⚙️ Processing ${sitemapQueue.length} sitemaps...`);
    const writer = new NdjsonWriter(this.config.itemsDir);
    const sitemapsLog = [];
    let totalProcessedThisRun = 0;
    let totalNewThisRun = 0;
    let duplicatesDuringRun = 0;

    await Promise.all(
      sitemapQueue.map((url) =>
        this.limiter(async () => {
          const stats = await this._processSitemap(url, writer, updateItemMeta);
          totalProcessedThisRun += stats.processed;
          totalNewThisRun += stats.newItems;
          duplicatesDuringRun += stats.duplicates;
          sitemapsLog.push({
            host: hostOf(url),
            url,
            itemCount: stats.processed,
            newItems: stats.newItems,
            duplicates: stats.duplicates,
          });
        })
      )
    );
    await writer.close();

    return {
      generatedAt: new Date().toISOString(),
      version: "2025.09.21-pw",
      totals: {
        hosts: hosts.length,
        sitemapsProcessed: sitemapsLog.length,
        itemsFound: totalProcessedThisRun,
        newItems: totalNewThisRun,
        duplicates: duplicatesDuringRun,
      },
      sitemaps: sitemapsLog.sort((a, b) => b.itemCount - a.itemCount),
    };
  }
}

/* ============================================================
   MAIN EXECUTION BLOCK
   ============================================================ */
async function main() {
  const argv = new Map(process.argv.slice(2).map((x) => (x.includes("=") ? x.split("=") : [x, true])));
  const MAX_HOSTS = argv.has("--max-hosts") ? Number(argv.get("--max-hosts")) : Infinity;

  console.log("🚀 Starting crawler (Playwright mode)...");
  await mkdir(cacheDir, { recursive: true });
  await mkdir(itemsDir, { recursive: true });
  await mkdir(robotsDir, { recursive: true });
  await startPlaywright();

  // URL metadata recorder (with timestamp)
  const urlmeta = JSON.parse((await readFile(urlmetaPath, "utf8").catch(() => "{}")) || "{}");
  for (const entry of Object.values(urlmeta)) {
    if (entry?.path) {
      entry.path = toRelativeCachePath(entry.path);
    }
  }
  const recordUrlMeta = (url, absPath, status = "", contentType = "") => {
    urlmeta[url] = {
      path: toRelativeCachePath(absPath),
      status,
      contentType,
      fetchedAt: new Date().toISOString(),
    };
  };

  // Hosts
  const hosts = (await readFile(hostsTxtPath, "utf8"))
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_HOSTS);

  // Bloom
  const bloomJSON = await readFile(bloomPath, "utf8").catch(() => null);
  const initialBloom = bloomJSON ? ScalableBloomFilter.fromJSON(JSON.parse(bloomJSON)) : undefined;

  // Items lifecycle state
  const itemsMeta = JSON.parse((await readFile(itemsMetaPath, "utf8").catch(() => "{}")) || "{}");
  const runsHistory = JSON.parse((await readFile(runsHistoryPath, "utf8").catch(() => "[]")) || "[]");

  const basenameIndex = {};
  for (const [id, meta] of Object.entries(itemsMeta)) {
    if (!meta.duplicateOf) {
      const basename = path.basename((meta.src || "").split("?")[0]);
      if (basename) basenameIndex[basename] = id;
    }
  }

  const seenIds = new Set();
  let newItemsCount = 0;
  let duplicateItemsCount = 0;

  const updateItemMeta = (id, info) => {
    seenIds.add(id);
    const now = new Date().toISOString();
    const itemType = info.itemType || "image";
    const rawSrc = info.src || "";
    const basename = path.basename((rawSrc.split("?")[0]) || "");
    let duplicateOf = null;

    if (!itemsMeta[id]) {
      if (itemType === "image") {
        if (basename && basenameIndex[basename]) {
          duplicateOf = basenameIndex[basename];
          duplicateItemsCount++;
        } else if (basename) {
          basenameIndex[basename] = id;
        }
      }
      itemsMeta[id] = {
        firstSeen: now,
        lastSeen: now,
        removedAt: null,
        src: info.src,
        pageUrl: info.pageUrl,
        lastMod: info.lastMod || "",
        title: info.title || "",
        host: info.host || "",
        sitemap: info.sitemap || "",
        duplicateOf,
        itemType,
      };
      newItemsCount++;
    } else {
      itemsMeta[id].lastSeen = now;
      itemsMeta[id].src = info.src;
      itemsMeta[id].pageUrl = info.pageUrl;
      itemsMeta[id].lastMod = info.lastMod || itemsMeta[id].lastMod;
      itemsMeta[id].title = info.title || itemsMeta[id].title;
      itemsMeta[id].host = info.host || itemsMeta[id].host;
      itemsMeta[id].sitemap = info.sitemap || itemsMeta[id].sitemap;
      itemsMeta[id].itemType = itemType;
      if (itemsMeta[id].removedAt) itemsMeta[id].removedAt = null;
      duplicateOf = itemsMeta[id].duplicateOf || null;
      if (!duplicateOf && itemType === "image" && basename && !basenameIndex[basename]) {
        basenameIndex[basename] = id;
      }
    }
    return duplicateOf;
  };

  const config = {
    concurrency: 12,
    itemsDir,
    initialBloom,
    recordUrlMeta,
  };

  const crawler = new Crawler(config);
  const summary = await crawler.run(hosts, updateItemMeta);

  // Removal / purge against retained runs
  const nowIso = new Date().toISOString();
  let earliestRun;
  if (runsHistory.length > 0) {
    const first = runsHistory[0];
    earliestRun = typeof first === "string" ? first : first.timestamp;
  } else {
    earliestRun = nowIso;
  }

  let removedThisRun = 0;
  let purgedCount = 0;
  let activeCount = 0;
  for (const id of Object.keys(itemsMeta)) {
    const meta = itemsMeta[id];
    if (meta.lastSeen < earliestRun) {
      delete itemsMeta[id];
      purgedCount++;
      continue;
    }
    if (!seenIds.has(id)) {
      if (!meta.removedAt) {
        meta.removedAt = nowIso;
        removedThisRun++;
      }
    } else {
      activeCount++;
    }
  }
  const totalCount = Object.keys(itemsMeta).length;

  summary.items = {
    added: newItemsCount,
    processed: Number(summary?.totals?.itemsFound ?? 0),
    discovered: Number(summary?.totals?.newItems ?? newItemsCount),
    duplicates: duplicateItemsCount,
    duplicatesThisRun: Number(summary?.totals?.duplicates ?? 0),
    removed: removedThisRun,
    purged: purgedCount,
    active: activeCount,
    total: totalCount,
  };

  // Aggregations
  const allImages = [];
  const allProductsMap = {};
  for (const [id, meta] of Object.entries(itemsMeta)) {
    if (meta.lastSeen < earliestRun) continue;
    const basename = path.basename((meta.src || "").split("?")[0]);
    allImages.push({
      id,
      src: meta.src,
      basename,
      firstSeen: meta.firstSeen,
      lastSeen: meta.lastSeen,
      duplicateOf: meta.duplicateOf || null,
      pageUrl: meta.pageUrl,
      title: meta.title,
      host: meta.host,
    });
    const key = meta.pageUrl || "";
    if (!allProductsMap[key]) {
      allProductsMap[key] = {
        pageUrl: key,
        title: meta.title || "",
        images: [],
        firstSeen: meta.firstSeen,
        lastSeen: meta.lastSeen,
      };
    }
    const prod = allProductsMap[key];
    prod.images.push({ id, src: meta.src, duplicateOf: meta.duplicateOf || null });
    if (!prod.title && meta.title) prod.title = meta.title;
    if (meta.firstSeen < prod.firstSeen) prod.firstSeen = meta.firstSeen;
    if (meta.lastSeen > prod.lastSeen) prod.lastSeen = meta.lastSeen;
  }
  const allProducts = Object.values(allProductsMap);

  const pageCount = allProducts.length;
  const uniqueImagesCount = allImages.length;
  summary.totals = summary.totals || {};
  summary.totals.pages = pageCount;
  summary.totals.images = uniqueImagesCount;

  const runRecord = {
    timestamp: nowIso,
    metrics: { ...summary.items },
    totals: { images: uniqueImagesCount, pages: pageCount },
  };
  runsHistory.push(runRecord);
  const MAX_RUNS = 5;
  if (runsHistory.length > MAX_RUNS) runsHistory.splice(0, runsHistory.length - MAX_RUNS);

  // Persist
  await saveJson(bloomPath, crawler.seenBloom.saveAsJSON());
  await saveJson(summaryPath, summary);
  await saveJson(urlmetaPath, JSON.parse(JSON.stringify(urlmeta)));
  await saveJson(itemsMetaPath, itemsMeta);
  await saveJson(runsHistoryPath, runsHistory);
  await saveJson(allImagesPath, allImages);
  await saveJson(allProductsPath, allProducts);

  console.log("\n🧮 Building lvreport dataset cache...");
  try {
    const lvreportModulePath = path.join(__dirname, "..", "..", "..", "_data", "lvreport.js");
    const { buildAndPersistReport, DATASET_REPORT_FILE } = await import(
      pathToFileURL(lvreportModulePath).href
    );
    const { payload } = await buildAndPersistReport({
      log: (message) => console.log(`   ${message}`),
    });
    const totals = payload?.totals || {};
    const relPath = DATASET_REPORT_FILE
      ? path.relative(process.cwd(), DATASET_REPORT_FILE)
      : "src/content/projects/lv-images/generated/lv/lvreport.dataset.json";
    console.log(
      `   lvreport cached → ${relPath} (images=${totals.images ?? "?"}, pages=${totals.pages ?? "?"})`,
    );
  } catch (error) {
    console.error(`\n💥 Failed to build lvreport dataset: ${error?.message || error}`);
    throw error;
  }

  try {
    const manifest = await bundleDataset({ skipIfMissing: true, quiet: true });
    if (manifest) {
      const shortHash = manifest.archive.sha256 ? manifest.archive.sha256.slice(0, 12) : "";
      console.log(
        `\n📦 Bundle updated → ${manifest.archive.path} ${shortHash ? `(sha256:${shortHash}…)` : ""}`.trim(),
      );
    }
  } catch (error) {
    console.warn(`\n⚠️ Failed to update lv bundle: ${error?.message || error}`);
  }

  console.log(`\n📊 Summary → ${path.relative(process.cwd(), summaryPath)}`);
  console.log(
    `   Processed: ${Number(summary.totals.itemsFound || 0).toLocaleString()} | New: ${newItemsCount.toLocaleString()} | Duplicates: ${Number(summary.items.duplicatesThisRun || 0).toLocaleString()} | Removed: ${removedThisRun.toLocaleString()} | Active: ${activeCount.toLocaleString()} | Total indexed: ${totalCount.toLocaleString()}`
  );

  await stopPlaywright();
}

main().catch(async (err) => {
  console.error("\n💥 FATAL ERROR:", err);
  await stopPlaywright();
  process.exitCode = 1;
});
