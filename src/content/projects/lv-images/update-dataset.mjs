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
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true });
  const root = parser.parse(xmlText);
  const urls = root?.urlset?.url ?? [];
  for (const entry of Array.isArray(urls) ? urls : [urls]) {
    const pageUrl = entry?.loc || "";
    const lastMod = entry?.lastmod || "";
    let images = entry?.image || entry?.["image:image"] || [];
    for (const image of Array.isArray(images) ? images : [images]) {
      const src = image?.loc || image?.["image:loc"] || "";
      const title = image?.title || image?.caption || "";
      if (src) yield { src, pageUrl, lastMod, title };
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
      if (this.config.updateItemMeta) {
        this.config.updateItemMeta(id, {
          src: item.src,
          pageUrl: item.pageUrl,
          lastMod: item.lastMod || item.lastmod || "",
          title: item.title || "",
          host: hostOf(url),
          sitemap: url
        });
      }
      if (!this.seenBloom.has(id)) {
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

  // Load persistent item metadata
  const itemsMeta = JSON.parse((await readFile(itemsMetaPath, "utf8").catch(() => "{}")) || "{}");
  // Set up structures to track items encountered this run
  const seenIds = new Set();
  let newItemsCount = 0;

  // Define updateItemMeta closure for Crawler to call per item
  const updateItemMeta = (id, info) => {
    seenIds.add(id);
    const now = new Date().toISOString();
    if (!itemsMeta[id]) {
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
      if (itemsMeta[id].removedAt) {
        // item reappeared; clear removal timestamp
        itemsMeta[id].removedAt = null;
      }
    }
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

  // After crawling, detect removed items and compute lifecycle stats
  const nowIso = new Date().toISOString();
  let removedThisRun = 0;
  let activeCount = 0;
  for (const id of Object.keys(itemsMeta)) {
    if (!seenIds.has(id)) {
      if (!itemsMeta[id].removedAt) {
        itemsMeta[id].removedAt = nowIso;
        removedThisRun++;
      }
    } else {
      activeCount++;
    }
  }
  const totalCount = Object.keys(itemsMeta).length;
  // Augment summary with item lifecycle statistics
  summary.items = {
    added: newItemsCount,
    removed: removedThisRun,
    active: activeCount,
    total: totalCount,
  };

  console.log("\n✅ Done. Finalizing state...");
  await saveJson(bloomPath, crawler.seenBloom.saveAsJSON());
  await saveJson(summaryPath, summary);
  await saveJson(urlmetaPath, urlmeta);
  await saveJson(itemsMetaPath, itemsMeta);

  console.log(`\n📊 Summary saved to: ${path.relative(process.cwd(), summaryPath)}`);
  console.log(`   Total Items Found (this run): ${summary.totals.itemsFound.toLocaleString()}`);
  console.log(`   New items added: ${newItemsCount}, Removed items: ${removedThisRun}, Active items: ${activeCount}, Total historical items: ${totalCount}`);
}

main().catch((err) => {
  console.error("\n💥 FATAL ERROR:", err);
  process.exitCode = 1;
});