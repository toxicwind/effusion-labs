// src/_data/lvreport.js
// ESM global data file for Eleventy (works with "type": "module")

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Adjust if your content root differs
const LV_BASE = path.resolve(__dirname, "../content/projects/lv-images/generated/lv");
const CACHE_DIR = path.join(LV_BASE, "cache");
const ROBOTS_DIR = path.join(CACHE_DIR, "robots");
const SITEMAPS_DIR = path.join(CACHE_DIR, "sitemaps");
const ITEMS_DIR = path.join(LV_BASE, "items");

const SUMMARY_JSON = path.join(LV_BASE, "summary.json");
const URLMETA_JSON = path.join(CACHE_DIR, "urlmeta.json");
const BLACKLIST_JSON = path.join(LV_BASE, "hosts", "blacklist.json");

async function loadJSON(p, fb) {
    try { return JSON.parse(await fs.readFile(p, "utf8")); }
    catch { return fb; }
}

function buildReverseUrlmeta(urlmeta) {
    const m = new Map();
    for (const [u, v] of Object.entries(urlmeta || {})) {
        if (v?.path) m.set(path.resolve(v.path), { url: u, status: v.status ?? "", contentType: v.contentType || "" });
    }
    return m;
}

async function* walk(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) yield* walk(p);
            else yield p;
        }
    } catch { }
}

async function sampleItems(dir, max = 60) {
    const out = [];
    try {
        const names = (await fs.readdir(dir)).filter(n => n.endsWith(".ndjson")).sort();
        for (const name of names) {
            const full = path.join(dir, name);
            const fd = await fs.open(full, "r");
            const stat = await fd.stat();
            const len = Math.min(stat.size, 1_500_000);
            const buf = Buffer.alloc(len);
            await fd.read(buf, 0, len, 0);
            await fd.close();
            const lines = buf.toString("utf8").split(/\r?\n/).filter(Boolean);
            for (const line of lines) {
                try { const obj = JSON.parse(line); if (obj?.src) out.push(obj); if (out.length >= max) return out; } catch { }
            }
        }
    } catch { }
    return out;
}

// Minimal robots.txt parser that keeps raw + nonstandard directives
function parseRobots(text) {
    const groups = []; // {agents:Set<string>, rules:[{type,path}]}
    const other = {};  // Contact, Host, Clean-param, etc.
    let cur = null;
    let ruleCount = 0;

    const lines = (text || "").split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const m = line.match(/^([A-Za-z][A-Za-z\-]*)\s*:\s*(.+)$/);
        if (!m) continue;
        const key = m[1].toLowerCase();
        const val = m[2].trim();

        if (key === "user-agent") {
            cur = { agents: new Set([val.toLowerCase()]), rules: [] };
            groups.push(cur);
            continue;
        }
        if (!cur) { cur = { agents: new Set(["*"]), rules: [] }; groups.push(cur); }

        if (key === "allow" || key === "disallow" || key === "noindex" || key === "crawl-delay" || key === "sitemap") {
            cur.rules.push({ type: key, path: val });
            ruleCount++;
        } else {
            const nk = key.replace(/[^a-z0-9]+/gi, "_");
            (other[nk] ||= []).push(val);
        }
    }

    const merged = { allow: [], disallow: [], noindex: [], crawlDelay: null, sitemaps: [] };
    for (const g of groups) {
        for (const r of g.rules) {
            if (r.type === "allow") merged.allow.push(r.path);
            if (r.type === "disallow") merged.disallow.push(r.path);
            if (r.type === "noindex") merged.noindex.push(r.path);
            if (r.type === "crawl-delay") {
                const n = Number(r.path);
                if (!Number.isNaN(n)) merged.crawlDelay = merged.crawlDelay == null ? n : Math.min(merged.crawlDelay, n);
            }
            if (r.type === "sitemap") merged.sitemaps.push(r.path);
        }
    }
    return { groups, merged, other, hasRules: ruleCount > 0 };
}

function classifySitemap(url) {
    const u = String(url).toLowerCase();
    if (u.includes("sitemap-image")) return "image";
    if (u.includes("sitemap-product")) return "product";
    if (u.includes("sitemap-content")) return "content";
    if (u.includes("sitemap-catalog")) return "catalog";
    if (u.endsWith("/sitemap.xml") || /\/sitemap[^/]*\.xml(\.gz)?$/.test(u)) return "index";
    return "other";
}

export default async function () {
    const [summary, urlmeta, blacklist] = await Promise.all([
        loadJSON(SUMMARY_JSON, {}),
        loadJSON(URLMETA_JSON, {}),
        loadJSON(BLACKLIST_JSON, {})
    ]);

    const rev = buildReverseUrlmeta(urlmeta);

    // Sitemaps table rows
    const sitemapsLog = Array.isArray(summary?.sitemaps) ? summary.sitemaps : [];
    const sitemaps = sitemapsLog.map(s => {
        const um = urlmeta[s.url] || {};
        return {
            host: s.host || "",
            url: s.url,
            type: classifySitemap(s.url),
            imageCount: s.imageCount || 0,
            status: um.status ?? "",
            savedPath: um.path
                ? path.relative(LV_BASE, path.resolve(um.path)).split(path.sep).join("/")
                : ""
        };
    });

    // All cached XML/TXT docs under cache/sitemaps/
    const docs = [];
    for await (const p of walk(SITEMAPS_DIR)) {
        if (!/\.(xml|txt|gz)$/i.test(p)) continue;
        const meta = rev.get(path.resolve(p)) || {};
        const url = meta.url || "";
        const host = (() => { try { return new URL(url).host; } catch { return path.basename(path.dirname(p)); } })();
        const kind = /\.xml(\.gz)?$/i.test(p) ? "xml" : /\.txt$/i.test(p) ? "txt" : "gz";
        docs.push({
            host,
            kind,
            url,
            status: meta.status ?? "",
            contentType: meta.contentType || "",
            savedPath: path.relative(LV_BASE, path.resolve(p)).split(path.sep).join("/")
        });
    }
    docs.sort((a, b) => a.host.localeCompare(b.host) || a.savedPath.localeCompare(b.savedPath));

    // Robots explorer: union of hosts with robots cache ∪ sitemaps hosts ∪ docs hosts
    const robotsHosts = new Set();
    try {
        const files = await fs.readdir(ROBOTS_DIR);
        for (const n of files) if (n.endsWith(".txt")) robotsHosts.add(n.replace(/\.txt$/i, ""));
    } catch { }
    for (const r of sitemaps) robotsHosts.add(r.host);
    for (const d of docs) robotsHosts.add(d.host);
    const allHosts = Array.from(robotsHosts).filter(Boolean).sort();

    const robots = [];
    for (const host of allHosts) {
        const robotsPath = path.join(ROBOTS_DIR, `${host}.txt`);
        let rawText = null;
        try { rawText = await fs.readFile(robotsPath, "utf8"); } catch { }
        const parsed = rawText ? parseRobots(rawText)
            : { groups: [], merged: { allow: [], disallow: [], noindex: [], crawlDelay: null, sitemaps: [] }, other: {}, hasRules: false };
        const bl = blacklist[host];
        robots.push({
            host,
            hasCached: !!rawText,
            robotsTxtPath: rawText ? path.relative(LV_BASE, robotsPath).split(path.sep).join("/") : "",
            rawText: rawText || "",
            linesTotal: rawText ? rawText.split(/\r?\n/).length : 0,
            parsed,
            blacklisted: !!bl, blacklistUntil: bl?.untilISO || "", blacklistReason: bl?.reason || ""
        });
    }

    const sample = await sampleItems(ITEMS_DIR, 60);

    return {
        lvreport: {
            baseHref: "/content/projects/lv-images/generated/lv/", // used for cached links
            summary,
            sitemaps,
            docs,
            robots,
            sample
        }
    };
}
