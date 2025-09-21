// update-dataset.mjs — enhanced for timestamp tracking and item lifecycle
//
// This script crawls sitemaps for configured hosts, downloads robots.txt
// files and XML payloads, and persists information about discovered items
// into NDJSON shards.  It uses a ScalableBloomFilter to avoid emitting
// duplicate items across runs.  Beyond the original functionality, the
// script now records first discovery times, last seen times and removal
// timestamps for each unique item.  A metadata file (`items-meta.json`)
// stores lifecycle information keyed by a stable ID derived from the item
// source URL.  Each run updates this metadata, marks items as removed
// when they disappear from sitemaps, and exposes counts of added,
// removed, active and total items in the summary.  URL metadata entries
// also include the fetch timestamp.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { gunzipSync } from "node:zlib";

import { XMLParser } from "fast-xml-parser";
import pLimit from "p-limit";
import pkg from "bloom-filters";
const { ScalableBloomFilter } = pkg;

import { decodeRobots } from "./robots_decode.mjs";

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

// Persisted item metadata.  Each entry tracks when an item was first
// discovered, when it was last seen in sitemaps and, if applicable,
// when it was removed.  The metadata file lives alongside the NDJSON
// shards and is updated on each run.
const itemsMetaPath = path.join(genDir, "items-meta.json");

// Track the last N run timestamps so we can evict old items.  We only
// retain metadata for items seen in the most recent 5 runs.  When a
// new run completes, its timestamp is appended to this array and
// older entries are discarded.  Items whose `lastSeen` falls before
// the earliest timestamp in this history will be purged from
// items-meta on the next update.
const runsHistoryPath = path.join(genDir, "runs-history.json");

// Aggregated lists of all images and products.  These files are
// regenerated on each run from the items-meta cache.  `all-images.json`
// contains one entry per image (unique id), including duplicate links;
// `all-products.json` contains one entry per pageUrl with a list of
// associated image ids.  Both lists exclude items that fall outside
// the retained history window.
const allImagesPath = path.join(genDir, "all-images.json");
const allProductsPath = path.join(genDir, "all-products.json");

// Adjust if your config lives elsewhere
const hostsTxtPath = path.join(baseDir, "./config/hosts.txt");

const bloomPath = path.join(cacheDir, "seen.bloom.json");
const summaryPath = path.join(genDir, "summary.json");

/* ============================================================
   STATELESS HELPERS & UTILITIES
   ============================================================ */
const sha1 = (s) => createHash("sha1").update(String(s || "")).digest("hex");
const shortId = (src) => sha1(src).slice(0, 16);
const hostOf = (u) => { try { return new URL(u).host; } catch { return ""; } };
const isGzipMagic = (buf) => Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
const saveJson = (p, obj) => writeFile(p, JSON.stringify(obj, null, 2), "utf8");

const isXmlLike = (text) => (text || "").trimStart().startsWith("<?xml");
const isHtmlLike = (text) => /<html/i.test((text || "").trimStart());
const detectExtension = (text) => (isXmlLike(text) ? "xml" : isHtmlLike(text) ? "html" : "txt");

const parseRobotsForSitemaps = (text) =>
  (text.match(/^Sitemap:\s*(.+)$/gim) || []).map((line) => line.replace(/^Sitemap:\s*/i, "").trim());

const isSitemapIndex = (xml) => /<sitemapindex\b/i.test(xml);

function* iterSitemapItems(xmlText) {
  /*
   * Robustly iterate over sitemap entries.
   *
   * Different sitemap flavours may encode images and loc values in
   * slightly different shapes.  Some entries only contain a single
   * `<loc>` tag (page URL) and no images, while others include one
   * or more `<image:image>` blocks with nested `<image:loc>` and
   * `<image:title>` elements.  A few edge cases: the `loc` field may
   * be an array if multiple `<loc>` tags appear (rare but possible);
   * image collections may appear under both `image` (namespace
   * stripped) and `image:image` keys; individual image objects may
   * contain `loc` or namespaced `image:loc` keys; and titles may be
   * stored in `title`, `caption`, or namespaced variants.  This
   * iterator normalises all of these cases and yields one entry per
   * image.  When a page has no images, a `page` item is emitted so
   * product/category pages without images are still captured.
   */
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true });
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
    // Single url entry
    entries = [root.urlset];
  } else {
    // Fallback: attempt to extract <loc> elements via regex when XML
    // structure is not as expected.  This covers rare cases where the
    // sitemap isn’t parsed into an object.  We yield only page
    // entries for these.
    const locRegex = /<loc>(.*?)<\/loc>/gi;
    let match;
    while ((match = locRegex.exec(xmlText))) {
      const url = match[1].trim();
      if (url) {
        yield { src: url, pageUrl: url, lastMod: "", title: "", itemType: "page" };
      }
    }
    return;
  }
  for (const entry of entries) {
    // normalise page URLs into an array
    let locField = entry?.loc;
    let pageUrls = [];
    if (Array.isArray(locField)) {
      pageUrls = locField.filter((u) => typeof u === "string" && u.trim()).map((u) => u.trim());
    } else if (typeof locField === "string" && locField.trim()) {
      pageUrls = [locField.trim()];
    } else if (locField && typeof locField === "object" && locField['#text']) {
      // handle cases where the parser wraps values under #text
      pageUrls = [String(locField['#text']).trim()];
    }
    const lastMod = entry?.lastmod || "";
    // normalise image collections
    let rawImages = entry?.image || entry?.["image:image"] || entry?.["image"];
    const images = rawImages ? (Array.isArray(rawImages) ? rawImages : [rawImages]) : [];
    if (images.length > 0) {
      const pageUrl = pageUrls.length > 0 ? pageUrls[0] : "";
      for (const img of images) {
        let src = img?.loc || img?.["image:loc"] || "";
        if (src && typeof src === "object" && src['#text']) src = String(src['#text']).trim();
        let title = img?.title || img?.caption || img?.["image:title"] || img?.["image:caption"] || "";
        if (title && typeof title === "object" && title['#text']) title = String(title['#text']).trim();
        if (src) {
          yield { src, pageUrl, lastMod, title, itemType: "image" };
        }
      }
    } else {
      // emit a page item for each page URL when no images exist
      for (const url of pageUrls) {
        yield { src: url, pageUrl: url, lastMod, title: "", itemType: "page" };
      }
    }
  }
}

// cache helper: returns/accepts absolute paths
const cache = {
  pathFor: (url, ext = "cache") => path.join(cacheDir, hostOf(url), `${sha1(url)}.${ext}`),
  async read(url, ext) {
    const p = this.pathFor(url, ext);
    try { return { text: await readFile(p, "utf8"), path: p }; } catch { }
    return null;
  },
  async write(url, content) {
    const ext = detectExtension(content);
    const p = this.pathFor(url, ext);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content, "utf8");
    return p;
  },
};

class NdjsonWriter {
  constructor(dir) { this.dir = dir; this.shardIndex = 0; this.shardLines = 0; this.totalItems = 0; this.stream = null; }
  async _openShard() {
    if (this.stream) await new Promise((r) => this.stream.end(r));
    this.shardIndex++; this.shardLines = 0;
    const ts = new Date().toISOString().replace(/[:.]/g, "");
    const shardPath = path.join(this.dir, `shard-${ts}-${String(this.shardIndex).padStart(3, "0")}.ndjson`);
    this.stream = createWriteStream(shardPath, { flags: "w" });
    await once(this.stream, "open");
  }
  async write(item) {
    if (!this.stream || this.shardLines >= 25000) await this._openShard();
    if (!this.stream.write(JSON.stringify(item) + "\n")) await once(this.stream, "drain");
    this.shardLines++; this.totalItems++;
  }
  async close() { if (this.stream) await new Promise((r) => this.stream.end(r)); }
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

  async _fetchAndCache(url) {
    const tryRead = async (ext) => {
      const hit = await cache.read(url, ext);
      return hit ? { text: hit.text, fromCache: true, cachePath: hit.path } : null;
    };

    const cached = (await tryRead("xml")) || (await tryRead("html")) || (await tryRead("txt"));
    if (cached) {
      console.log(`  ➡️ [CACHE HIT] ${url}`);
      return { ...cached, status: "", contentType: "" };
    }

    console.log(`  ➡️ [LIVE FETCH] ${url}`);
    try {
      const res = await fetch(url, { headers: { "User-Agent": this.config.userAgent } });
      if (!res.ok) return { error: `HTTP ${res.status}`, status: String(res.status) };
      let buf = Buffer.from(await res.arrayBuffer());
      if (isGzipMagic(buf)) buf = gunzipSync(buf);
      const fetchedText = buf.toString("utf8");
      const savedPath = await cache.write(url, fetchedText);
      return {
        text: fetchedText,
        fromCache: false,
        cachePath: savedPath,
        status: String(res.status),
        contentType: res.headers.get("content-type") || ""
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async _discoverHost(host) {
    console.log(`\n🕵️‍♂️ Discovering sitemaps for ${host}...`);
    const robotsUrl = `https://${host}/robots.txt`;
    const robotsRes = await this._fetchAndCache(robotsUrl);

    if (robotsRes.text) {
      // Write normalized per-host robots files
      const robotsTxtFile = path.join(robotsDir, `${host}.txt`);
      await writeFile(robotsTxtFile, robotsRes.text, "utf8");
      const decoded = decodeRobots(robotsRes.text, `https://${host}`);
      const robotsJsonFile = path.join(robotsDir, `${host}.json`);
      await writeFile(robotsJsonFile, JSON.stringify(decoded, null, 2), "utf8");

      // urlmeta for report, include fetch timestamp
      this.config.recordUrlMeta?.(robotsUrl, robotsTxtFile, robotsRes.status, robotsRes.contentType);
    }

    const sitemapsFromRobots = robotsRes.text ? parseRobotsForSitemaps(robotsRes.text) : [];
    console.log(`  ✅ Found ${sitemapsFromRobots.length} sitemap(s) in robots.txt`);

    const foundUrls = new Set(sitemapsFromRobots);
    this.config.sitemapVariants.forEach((v) => foundUrls.add(`https://${host}${v}`));

    const finalSitemaps = new Set();
    const queue = [...foundUrls];
    const visited = new Set();

    console.log(`  ➡️ Expanding ${queue.length} starting URLs...`);
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      const res = await this._fetchAndCache(url);
      if (res?.cachePath) this.config.recordUrlMeta?.(url, res.cachePath, res.status, res.contentType);

      if (!res?.text || !isXmlLike(res.text)) {
        if (res?.text) console.log(`    - Skipping non-XML content at ${url}`);
        continue;
      }

      if (isSitemapIndex(res.text)) {
        const childUrls = (res.text.match(/<loc>(.*?)<\/loc>/g) || []).map((s) => s.replace(/<\/?loc>/g, ""));
        console.log(`    - Found index at ${url} with ${childUrls.length} children.`);
        childUrls.forEach((u) => { if (!visited.has(u)) queue.push(u); });
      } else {
        console.log(`    - ✅ Found final content sitemap: ${url}`);
        finalSitemaps.add(url);
      }
    }

    console.log(`🕵️‍♂️ Discovery for ${host} complete. Found ${finalSitemaps.size} content sitemaps.`);
    return { host, sitemaps: [...finalSitemaps], robotsInfo: { url: robotsUrl, found: sitemapsFromRobots.length > 0 } };
  }

  async _processSitemap(url, writer) {
    const hit = await cache.read(url, "xml");
    const text = hit?.text || null;
    if (!text) {
      console.log(`  - ⚠️ Could not read cached file for ${url}`);
      return 0;
    }

    let itemCount = 0;
    for (const item of iterSitemapItems(text)) {
      const id = shortId(item.src);
      // update per-item metadata regardless of Bloom membership
      let isDuplicate = false;
      if (this.config.updateItemMeta) {
        const dupId = this.config.updateItemMeta(id, {
          src: item.src,
          pageUrl: item.pageUrl,
          lastMod: item.lastMod || item.lastmod || "",
          title: item.title || "",
          host: hostOf(url),
          sitemap: url,
          itemType: item.itemType || "image",
        });
        isDuplicate = !!dupId;
      }
      // Skip writing duplicates to NDJSON to avoid bloating shards.  We
      // still update the Bloom filter for canonical items, but do not
      // insert duplicate ids since they are not emitted.
      if (!isDuplicate && !this.seenBloom.has(id)) {
        await writer.write({ ...item, id, host: hostOf(url), sitemap: url });
        this.seenBloom.add(id);
        itemCount++;
      }
    }
    console.log(`  - Parsed ${itemCount} new items from ${path.basename(url)}`);
    return itemCount;
  }

  async run(hosts) {
    console.log(`\n🔍 Starting discovery for ${hosts.length} hosts...`);
    const discoveryResults = await Promise.all(
      hosts.map((host) => this.limiter(() => this._discoverHost(host)))
    );

    console.log("\n💾 Saving per-host discovery metadata...");
    await Promise.all(
      discoveryResults.filter(Boolean).map((result) => {
        const hostCacheDir = path.join(cacheDir, result.host);
        const indexPath = path.join(hostCacheDir, "_index.json");
        const metadata = {
          host: result.host,
          discoveredAt: new Date().toISOString(),
          robotsInfo: result.robotsInfo,
          sitemaps: result.sitemaps,
        };
        console.log(`  - Writing metadata for ${result.host}`);
        return saveJson(indexPath, metadata);
      })
    );

    const sitemapQueue = discoveryResults.filter(Boolean).flatMap((r) => r.sitemaps);
    console.log(`\n⚙️ Processing ${sitemapQueue.length} total sitemaps...`);
    const writer = new NdjsonWriter(this.config.itemsDir);
    const sitemapsLog = [];

    await Promise.all(
      sitemapQueue.map((url) =>
        this.limiter(async () => {
          const itemCount = await this._processSitemap(url, writer);
          sitemapsLog.push({ host: hostOf(url), url, itemCount });
        })
      )
    );
    await writer.close();

    return {
      generatedAt: new Date().toISOString(),
      version: "2025.09.20",
      totals: { hosts: hosts.length, sitemapsProcessed: sitemapsLog.length, itemsFound: writer.totalItems },
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

  console.log("🚀 Starting crawler...");
  await mkdir(cacheDir, { recursive: true });
  await mkdir(itemsDir, { recursive: true });
  await mkdir(robotsDir, { recursive: true });

  // Load existing URL metadata and define a recorder that also captures fetch timestamps
  const urlmeta = JSON.parse((await readFile(urlmetaPath, "utf8").catch(() => "{}")) || "{}");
  const recordUrlMeta = (url, absPath, status = "", contentType = "") => {
    urlmeta[url] = {
      path: path.resolve(absPath),
      status,
      contentType,
      fetchedAt: new Date().toISOString(),
    };
  };

  // Load hosts list
  const hosts = (await readFile(hostsTxtPath, "utf8"))
    .split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, MAX_HOSTS);

  // Load bloom filter state
  const bloomJSON = await readFile(bloomPath, "utf8").catch(() => null);
  const initialBloom = bloomJSON ? ScalableBloomFilter.fromJSON(JSON.parse(bloomJSON)) : undefined;

  // Load persistent item metadata (id -> metadata record).  Each record
  // tracks lifecycle fields and duplicate relationships.  If the file
  // does not exist, start with an empty object.
  const itemsMeta = JSON.parse((await readFile(itemsMetaPath, "utf8").catch(() => "{}")) || "{}");
  // Load the run history which records timestamps of the most recent
  // runs.  Used to evict stale items after we reach the retention
  // limit.  If absent, start with an empty array.
  const runsHistory = JSON.parse((await readFile(runsHistoryPath, "utf8").catch(() => "[]")) || "[]");

  // Rebuild a lookup from image basenames to canonical IDs.  A
  // canonical ID is an id whose record either has no duplicateOf
  // field or where duplicateOf is null.  When new items arrive
  // whose basename matches an existing one, they will be marked
  // duplicates of the canonical entry.  We also gather ids seen in
  // this run and count new items.
  const basenameIndex = {};
  for (const [id, meta] of Object.entries(itemsMeta)) {
    if (!meta.duplicateOf) {
      const basename = path.basename((meta.src || "").split("?")[0]);
      if (basename) {
        basenameIndex[basename] = id;
      }
    }
  }

  const seenIds = new Set();
  let newItemsCount = 0;
  let duplicateItemsCount = 0;

  // Define updateItemMeta closure for Crawler to call per item.  This
  // function updates the itemsMeta object, performs duplicate
  // detection based on filename, and returns the canonical id if
  // duplicate or null otherwise.  It also records ids seen in this
  // run and counts newly added and duplicate items.
  const updateItemMeta = (id, info) => {
    seenIds.add(id);
    const now = new Date().toISOString();
    // Compute duplicate information only for images.  We strip any
    // querystring from the src to derive a basename used to detect
    // identical filenames across different URLs.  Pages (itemType
    // 'page') are never deduplicated because multiple entries can
    // legitimately share the same slug across categories.
    const itemType = info.itemType || "image";
    const rawSrc = info.src || "";
    const basename = path.basename((rawSrc.split("?")[0]) || "");
    let duplicateOf = null;
    if (!itemsMeta[id]) {
      if (itemType === "image") {
        // Determine canonical id for this basename (if any)
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
        duplicateOf: duplicateOf,
        itemType: itemType,
      };
      newItemsCount++;
    } else {
      // Existing item: update lifecycle fields and respect duplicate
      // status.  Note that we do not change duplicateOf once set.
      itemsMeta[id].lastSeen = now;
      itemsMeta[id].src = info.src;
      itemsMeta[id].pageUrl = info.pageUrl;
      itemsMeta[id].lastMod = info.lastMod || itemsMeta[id].lastMod;
      itemsMeta[id].title = info.title || itemsMeta[id].title;
      itemsMeta[id].host = info.host || itemsMeta[id].host;
      itemsMeta[id].sitemap = info.sitemap || itemsMeta[id].sitemap;
      itemsMeta[id].itemType = itemType;
      if (itemsMeta[id].removedAt) {
        itemsMeta[id].removedAt = null;
      }
      duplicateOf = itemsMeta[id].duplicateOf || null;
      // If this is an image that became canonical earlier and the
      // basename was unknown, populate the index now.  We only
      // register image basenames to avoid colliding page URLs.
      if (!duplicateOf && itemType === "image" && basename && !basenameIndex[basename]) {
        basenameIndex[basename] = id;
      }
    }
    return duplicateOf;
  };

  const config = {
    concurrency: 16,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0",
    sitemapVariants: ["/sitemap.xml", "/sitemap_index.xml"],
    itemsDir,
    initialBloom,
    recordUrlMeta,
    updateItemMeta,
  };

  const crawler = new Crawler(config);
  const summary = await crawler.run(hosts);

  // We no longer push the run timestamp here.  Runs history entries are
  // appended later once we know how many unique images/pages exist.  The
  // runsHistory array may contain either strings (legacy) or objects
  // with detailed metrics.  We leave it untouched here so that
  // removal detection can still use the prior retention window.

  // After crawling, detect removed items, purge stale ones based on
  // history retention, and compute lifecycle stats.  Anything not
  // encountered in this run is marked removed, and any item whose
  // lastSeen predates the earliest retained run is evicted from
  // metadata entirely.
  const nowIso = new Date().toISOString();
  // Determine earliest run timestamp to retain.  Runs history may
  // contain strings (timestamps) or objects { timestamp: ..., ... }.
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
    // purge items whose lastSeen is older than earliest run (not within retention)
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
  // Augment summary with item lifecycle statistics, including duplicates
  summary.items = {
    added: newItemsCount,
    duplicates: duplicateItemsCount,
    removed: removedThisRun,
    purged: purgedCount,
    active: activeCount,
    total: totalCount,
  };

  // Build aggregated lists of all images and all products within
  // retention window.  We exclude any items whose lastSeen is older
  // than the earliest run we retain.  Each image entry includes
  // duplicateOf if applicable.  Each product entry groups images by
  // their pageUrl and tracks earliest and latest sightings.
  const allImages = [];
  const allProductsMap = {};
  for (const [id, meta] of Object.entries(itemsMeta)) {
    // Only include active (non-purged) items
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
    const productKey = meta.pageUrl || "";
    if (!allProductsMap[productKey]) {
      allProductsMap[productKey] = {
        pageUrl: productKey,
        title: meta.title || "",
        images: [],
        firstSeen: meta.firstSeen,
        lastSeen: meta.lastSeen,
      };
    }
    const prod = allProductsMap[productKey];
    prod.images.push({ id, src: meta.src, duplicateOf: meta.duplicateOf || null });
    if (!prod.title && meta.title) prod.title = meta.title;
    if (meta.firstSeen < prod.firstSeen) prod.firstSeen = meta.firstSeen;
    if (meta.lastSeen > prod.lastSeen) prod.lastSeen = meta.lastSeen;
  }
  const allProducts = Object.values(allProductsMap);

  // Compute counts of unique page entries (products).  Each product
  // corresponds to a unique pageUrl.  This count is added to the
  // summary totals as `pages` so the report can display how many
  // product/category pages were discovered across all sitemaps.
  const pageCount = allProducts.length;
  // Populate pages count into summary totals.  The existing
  // `itemsFound` already tracks the number of unique image entries
  // emitted in the NDJSON writer.
  summary.totals = summary.totals || {};
  summary.totals.pages = pageCount;

  // Compute unique image count (non-duplicate) for this run.  This
  // includes all active images within the retention window.  We set
  // this on the summary so the report can show how many distinct
  // images exist across all runs.  Note: duplicates are still
  // reflected via the `duplicates` metric in summary.items.
  const uniqueImagesCount = allImages.length;
  summary.totals.images = uniqueImagesCount;

  // -----------------------------------------------------------------
  // Append the current run into the runs history.  We store a
  // structured record containing timestamp, item lifecycle metrics
  // and total counts of images and pages.  Only the most recent
  // N runs (default 5) are retained.  If runsHistory contains
  // strings (legacy), they are preserved but we push objects from
  // now on.  Eviction of old metadata occurs based on earliest
  // retained timestamp earlier in this script.
  const runRecord = {
    timestamp: nowIso,
    metrics: { ...summary.items },
    totals: {
      images: uniqueImagesCount,
      pages: pageCount,
    },
  };
  // Push the new run record and prune to last 5
  runsHistory.push(runRecord);
  const MAX_RUNS = 5;
  // Keep only the last MAX_RUNS entries
  if (runsHistory.length > MAX_RUNS) {
    // Remove oldest entries
    runsHistory.splice(0, runsHistory.length - MAX_RUNS);
  }

  console.log("\n✅ Done. Finalizing state...");
  await saveJson(bloomPath, crawler.seenBloom.saveAsJSON());
  await saveJson(summaryPath, summary);
  await saveJson(urlmetaPath, urlmeta);
  await saveJson(itemsMetaPath, itemsMeta);
  await saveJson(runsHistoryPath, runsHistory);
  await saveJson(allImagesPath, allImages);
  await saveJson(allProductsPath, allProducts);

  console.log(`\n📊 Summary saved to: ${path.relative(process.cwd(), summaryPath)}`);
  console.log(`   Total Items Found (this run): ${summary.totals.itemsFound.toLocaleString()}`);
  console.log(`   New items added: ${newItemsCount}, Removed items: ${removedThisRun}, Active items: ${activeCount}, Total historical items: ${totalCount}`);
  console.log(`   Duplicate items detected: ${duplicateItemsCount}, Purged items: ${purgedCount}`);
}

main().catch((err) => {
  console.error("\n💥 FATAL ERROR:", err);
  process.exitCode = 1;
});