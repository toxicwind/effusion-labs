// src/_data/lvreport.js — prefers decoded robots JSON, falls back to text parser

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LV_BASE = path.resolve(__dirname, "../content/projects/lv-images/generated/lv");
const CACHE_DIR = path.join(LV_BASE, "cache");
const ROBOTS_DIR = path.join(CACHE_DIR, "robots");
const SITEMAPS_DIR = path.join(CACHE_DIR, "sitemaps");
const ITEMS_DIR = path.join(LV_BASE, "items");

const SUMMARY_JSON = path.join(LV_BASE, "summary.json");
const URLMETA_JSON = path.join(CACHE_DIR, "urlmeta.json");
const BLACKLIST_JSON = path.join(LV_BASE, "hosts", "blacklist.json");

async function loadJSON(p, fb) { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return fb; } }
async function loadDecodedRobots(host) {
    const decodedPath = path.join(ROBOTS_DIR, `${host}.json`);
    try { return JSON.parse(await fs.readFile(decodedPath, "utf8")); } catch { return null; }
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
        const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".ndjson")).sort();
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
                try {
                    const obj = JSON.parse(line);
                    if (obj?.src) out.push(obj);
                    if (out.length >= max) return out;
                } catch { }
            }
        }
    } catch { }
    return out;
}

// Fallback minimal parser for robots.txt (used only if no decoded JSON exists)
function parseRobots(text) {
    const groups = [];
    const other = {};
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

        if (["allow", "disallow", "noindex", "crawl-delay", "sitemap"].includes(key)) {
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

const STATUS_NAME = {
    301: "Moved Permanently", 302: "Found", 307: "Temporary Redirect", 308: "Permanent Redirect",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 410: "Gone",
    429: "Too Many Requests", 500: "Internal Server Error", 503: "Service Unavailable"
};

const ROBOTS_CATEGORY_META = {
    ok: { label: "Valid robots.txt", tone: "ok", issue: false },
    "html-error": { label: "HTML error page", tone: "error", issue: true },
    "json-error": { label: "JSON error", tone: "error", issue: true },
    json: { label: "JSON payload", tone: "info", issue: false },
    text: { label: "Plain text (no directives)", tone: "warn", issue: true },
    empty: { label: "Empty response", tone: "error", issue: true },
    "no-cache": { label: "No cached copy", tone: "warn", issue: true }
};

const DOC_CATEGORY_META = {
    xml: { label: "XML document", tone: "ok", issue: false },
    "html-error": { label: "HTML error page", tone: "error", issue: true },
    "json-error": { label: "JSON error", tone: "error", issue: true },
    json: { label: "JSON payload", tone: "info", issue: false },
    "robots-txt": { label: "Robots/text directives", tone: "info", issue: false },
    text: { label: "Plain text", tone: "info", issue: false },
    gzip: { label: "Compressed (.gz)", tone: "warn", issue: true },
    empty: { label: "Empty response", tone: "error", issue: true },
    unknown: { label: "Unclassified", tone: "warn", issue: true }
};

function normalizeReason(reason) {
    if (!reason) return "";
    return reason.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function formatHttpStatus(code, reason) {
    if (!code) return normalizeReason(reason);
    const label = normalizeReason(reason) || STATUS_NAME[code] || "";
    return label ? `${code} ${label}` : String(code);
}
function extractHttpStatus(text) {
    if (!text) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            const obj = JSON.parse(trimmed);
            if (typeof obj?.statusCode === "number") {
                const code = obj.statusCode;
                const reason = obj.error || obj.message || STATUS_NAME[code] || "";
                return { code, reason: normalizeReason(reason) };
            }
        } catch { }
    }
    const titleMatch = trimmed.match(/<title>\s*(\d{3})\s*([^<]*)/i);
    if (titleMatch) return { code: Number(titleMatch[1]), reason: normalizeReason(titleMatch[2]) };
    const h1Match = trimmed.match(/<h1>\s*(\d{3})\s*([^<]*)/i);
    if (h1Match) return { code: Number(h1Match[1]), reason: normalizeReason(h1Match[2]) };

    const statusCodeMatch = trimmed.match(/\b(301|302|307|308|400|401|403|404|410|429|500|503)\b/);
    let code = statusCodeMatch ? Number(statusCodeMatch[1]) : null;

    let reason = null;
    if (/Forbidden/i.test(trimmed)) reason = "Forbidden";
    else if (/Unauthorized/i.test(trimmed)) reason = "Unauthorized";
    else if (/Not Found/i.test(trimmed) || /Cannot GET/i.test(trimmed)) reason = "Not Found";
    else if (/Too Many Requests/i.test(trimmed)) reason = "Too Many Requests";
    else if (/Service Unavailable|Unavailable/i.test(trimmed)) reason = "Service Unavailable";
    else if (/Access Denied/i.test(trimmed)) reason = "Access Denied";
    else if (/Bad Request/i.test(trimmed)) reason = "Bad Request";

    if (!code && reason) {
        const map = { Forbidden: 403, Unauthorized: 401, "Not Found": 404, "Too Many Requests": 429, "Service Unavailable": 503, "Access Denied": 403, "Bad Request": 400 };
        code = map[reason] || null;
    }
    if (code) return { code, reason: reason || STATUS_NAME[code] || "" };
    if (reason) return { code: null, reason };
    return null;
}

function classifyRobotsResponse(rawText, hasCached) {
    if (!hasCached) return { category: "no-cache", label: ROBOTS_CATEGORY_META["no-cache"].label, tone: ROBOTS_CATEGORY_META["no-cache"].tone, isIssue: true, httpStatus: null, httpLabel: "" };
    const trimmed = (rawText || "").trim();
    if (!trimmed) return { category: "empty", label: ROBOTS_CATEGORY_META.empty.label, tone: ROBOTS_CATEGORY_META.empty.tone, isIssue: true, httpStatus: null, httpLabel: "" };
    if (/<!DOCTYPE html|<html/i.test(trimmed.substring(0, 200))) {
        const status = extractHttpStatus(trimmed);
        const httpLabel = status ? formatHttpStatus(status.code, status.reason) : "HTML response";
        return { category: "html-error", label: httpLabel, tone: ROBOTS_CATEGORY_META["html-error"].tone, isIssue: true, httpStatus: status?.code ?? null, httpLabel };
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const status = extractHttpStatus(trimmed);
        const isError = !!status && typeof status.code === "number" && status.code >= 400;
        const category = isError ? "json-error" : "json";
        const meta = ROBOTS_CATEGORY_META[category] || ROBOTS_CATEGORY_META.json;
        const httpLabel = status ? formatHttpStatus(status.code, status.reason) : meta.label;
        return { category, label: httpLabel, tone: meta.tone, isIssue: meta.issue || isError, httpStatus: status?.code ?? null, httpLabel };
    }
    if (!/user-agent/i.test(trimmed)) {
        const meta = ROBOTS_CATEGORY_META.text;
        return { category: "text", label: meta.label, tone: meta.tone, isIssue: meta.issue, httpStatus: null, httpLabel: "" };
    }
    const meta = ROBOTS_CATEGORY_META.ok;
    return { category: "ok", label: meta.label, tone: meta.tone, isIssue: meta.issue, httpStatus: null, httpLabel: "" };
}

function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes; let idx = 0;
    while (value >= 1024 && idx < units.length - 1) { value /= 1024; idx++; }
    const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} ${units[idx]}`;
}

function truncatePreview(text, max = 320) {
    if (!text) return "";
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max).trim()}…`;
}

function makeBreakdown(counts, meta, total) {
    return Object.entries(counts).map(([key, count]) => {
        const m = meta[key] || { label: key, tone: "info", issue: false };
        const pct = total ? (count / total) * 100 : 0;
        return { key, label: m.label, tone: m.tone, issue: m.issue, count, pct: Math.round(pct * 10) / 10 };
    }).sort((a, b) => {
        const toneRank = { error: 0, warn: 1, info: 2, ok: 3 };
        const td = (toneRank[a.tone] ?? 4) - (toneRank[b.tone] ?? 4);
        if (td !== 0) return td;
        return b.count - a.count;
    });
}

function classifyDocContent(filePath, previewText) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".gz") return { category: "gzip", label: "Compressed (.gz)", tone: "warn", isIssue: true, httpStatus: null, httpLabel: "" };
    const text = (previewText || "").trim();
    if (!text) return { category: "empty", label: "Empty response", tone: "error", isIssue: true, httpStatus: null, httpLabel: "" };
    if (/<!DOCTYPE html|<html/i.test(text.substring(0, 200))) {
        const status = extractHttpStatus(text);
        return { category: "html-error", label: status ? `${status.code ?? ""} ${status.reason ?? ""}`.trim() : "HTML error page", tone: "error", isIssue: true, httpStatus: status?.code ?? null, httpLabel: status ? `${status.code ?? ""} ${status.reason ?? ""}`.trim() : "HTML error page" };
    }
    if (text.startsWith("{") || text.startsWith("[")) {
        const status = extractHttpStatus(text);
        const isError = !!status && typeof status.code === "number" && status.code >= 400;
        const label = status ? `${status.code ?? ""} ${status.reason ?? ""}`.trim() : "JSON payload";
        return { category: isError ? "json-error" : "json", label, tone: isError ? "error" : "info", isIssue: !!isError, httpStatus: status?.code ?? null, httpLabel: label };
    }
    if (/^<\?xml/i.test(text) || /^<(urlset|sitemapindex|feed|rss)\b/i.test(text)) return { category: "xml", label: "XML document", tone: "ok", isIssue: false, httpStatus: null, httpLabel: "" };
    if (/User-agent|Disallow|Allow/i.test(text)) return { category: "robots-txt", label: "Robots/text directives", tone: "info", isIssue: false, httpStatus: null, httpLabel: "" };
    if (/[a-z]/i.test(text)) return { category: "text", label: "Plain text", tone: "info", isIssue: false, httpStatus: null, httpLabel: "" };
    return { category: "unknown", label: "Unclassified", tone: "warn", isIssue: true, httpStatus: null, httpLabel: "" };
}

export default async function () {
    const [summary, urlmeta, blacklist] = await Promise.all([
        loadJSON(SUMMARY_JSON, {}),
        loadJSON(URLMETA_JSON, {}),
        loadJSON(BLACKLIST_JSON, {})
    ]);

    const rev = buildReverseUrlmeta(urlmeta);

    // Sitemaps table rows (summary.sitemaps now contains {host,url,itemCount})
    const sitemapsLog = Array.isArray(summary?.sitemaps) ? summary.sitemaps : [];
    const sitemaps = sitemapsLog.map((s) => {
        const um = urlmeta[s.url] || {};
        return {
            host: s.host || "",
            url: s.url,
            type: classifySitemap(s.url),
            imageCount: s.itemCount || 0,
            status: um.status ?? "",
            savedPath: um.path ? path.relative(LV_BASE, path.resolve(um.path)).split(path.sep).join("/") : ""
        };
    });

    // All cached XML/TXT docs under cache/sitemaps/
    const docs = [];
    const docCounts = Object.create(null);
    for await (const absPath of walk(SITEMAPS_DIR)) {
        if (!/\.(xml|txt|gz)$/i.test(absPath)) continue;
        const meta = rev.get(path.resolve(absPath)) || {};
        const url = meta.url || "";
        const host = (() => { try { return new URL(url).host; } catch { return path.basename(path.dirname(absPath)); } })();
        const relPath = path.relative(LV_BASE, path.resolve(absPath)).split(path.sep).join("/");
        const kind = /\.xml(\.gz)?$/i.test(absPath) ? "xml" : /\.txt$/i.test(absPath) ? "txt" : "bin";

        let sizeBytes = 0, previewSource = "";
        if (relPath.endsWith(".gz")) {
            try { const stat = await fs.stat(absPath); sizeBytes = stat.size; } catch { }
        } else {
            try {
                const fh = await fs.open(absPath, "r");
                const stat = await fh.stat();
                const len = Math.min(stat.size, 4096);
                const buf = Buffer.alloc(len);
                await fh.read(buf, 0, len, 0);
                await fh.close();
                previewSource = buf.toString("utf8");
                sizeBytes = stat.size;
            } catch {
                try { const statFallback = await fs.stat(absPath); sizeBytes = statFallback.size; } catch { }
            }
        }

        const classification = classifyDocContent(relPath, previewSource);
        docCounts[classification.category] = (docCounts[classification.category] || 0) + 1;

        const preview = ((t, m = 360) => {
            const trimmed = (t || "").trim();
            if (trimmed.length <= m) return trimmed;
            return `${trimmed.slice(0, m).trim()}…`;
        })(previewSource, 360);

        docs.push({
            host,
            kind,
            url,
            status: meta.status ?? "",
            contentType: meta.contentType || "",
            savedPath: relPath,
            fileName: path.basename(absPath),
            sizeBytes,
            sizeLabel: formatBytes(sizeBytes),
            statusCategory: classification.category,
            statusLabel: classification.label,
            statusTone: classification.tone,
            httpStatus: classification.httpStatus ?? null,
            httpLabel: classification.httpLabel || "",
            isIssue: classification.isIssue,
            preview
        });
    }
    docs.sort((a, b) => a.host.localeCompare(b.host) || a.savedPath.localeCompare(b.savedPath));

    // Robots explorer: union of hosts we know about
    const robotsHosts = new Set();
    try {
        const files = await fs.readdir(ROBOTS_DIR);
        for (const n of files) if (n.endsWith(".txt")) robotsHosts.add(n.replace(/\.txt$/i, ""));
    } catch { }
    for (const r of sitemaps) robotsHosts.add(r.host);
    for (const d of docs) robotsHosts.add(d.host);
    const allHosts = Array.from(robotsHosts).filter(Boolean).sort();

    const robots = [];
    const robotsCounts = Object.create(null);
    for (const host of allHosts) {
        const robotsPath = path.join(ROBOTS_DIR, `${host}.txt`);
        let rawText = null;
        try { rawText = await fs.readFile(robotsPath, "utf8"); } catch { }

        const decoded = await loadDecodedRobots(host);

        let parsed;
        if (decoded) {
            const allow = [], disallow = [], noindex = [];
            const sitemaps = decoded.summary?.sitemaps || [];
            let crawlDelay = decoded.summary?.crawlDelay ?? null;

            for (const g of decoded.groups || []) {
                for (const r of g.rules || []) {
                    if (r.type === "allow") allow.push(r.value);
                    else if (r.type === "disallow") disallow.push(r.value);
                    else if (r.type === "noindex") noindex.push(r.value);
                    else if (r.type === "crawl-delay") {
                        const n = Number(r.value);
                        if (!Number.isNaN(n)) crawlDelay = crawlDelay == null ? n : Math.min(crawlDelay, n);
                    }
                }
            }

            // unknown directives
            const other = {};
            for (const line of decoded.lines || []) {
                if (line.type !== "directive") continue;
                const k = (line.directive || "").toLowerCase();
                if (!k || ["user-agent", "allow", "disallow", "noindex", "sitemap", "crawl-delay"].includes(k)) continue;
                (other[k] ||= []).push(line.value || "");
            }

            parsed = {
                groups: decoded.groups || [],
                merged: { allow, disallow, noindex, crawlDelay, sitemaps },
                other,
                hasRules: (allow.length + disallow.length + noindex.length + sitemaps.length) > 0
            };
        } else {
            parsed = rawText ? parseRobots(rawText)
                : { groups: [], merged: { allow: [], disallow: [], noindex: [], crawlDelay: null, sitemaps: [] }, other: {}, hasRules: false };
        }

        const trimmed = rawText || "";
        const classification = (() => {
            const cat = (() => {
                if (!rawText) return "no-cache";
                const t = trimmed.trim();
                if (!t) return "empty";
                if (/<!DOCTYPE html|<html/i.test(t.substring(0, 200))) return "html-error";
                if (t.startsWith("{") || t.startsWith("[")) {
                    const status = (() => {
                        // tiny reuse: parse the status like earlier
                        try {
                            const obj = JSON.parse(t);
                            if (typeof obj?.statusCode === "number") return { code: obj.statusCode, reason: obj.error || obj.message || "" };
                        } catch { }
                        return null;
                    })();
                    return status && status.code >= 400 ? "json-error" : "json";
                }
                if (!/user-agent/i.test(t)) return "text";
                return "ok";
            })();
            const meta = ROBOTS_CATEGORY_META[cat] || ROBOTS_CATEGORY_META.ok;
            let httpStatus = null, httpLabel = "";
            if (cat === "html-error" || cat === "json-error") {
                const status = (() => {
                    const titleMatch = trimmed.match(/<title>\s*(\d{3})\s*([^<]*)/i);
                    if (titleMatch) return { code: Number(titleMatch[1]), reason: titleMatch[2].trim() };
                    const h1Match = trimmed.match(/<h1>\s*(\d{3})\s*([^<]*)/i);
                    if (h1Match) return { code: Number(h1Match[1]), reason: h1Match[2].trim() };
                    return null;
                })();
                httpStatus = status?.code ?? null;
                httpLabel = status ? `${status.code ?? ""} ${status.reason ?? ""}`.trim() : meta.label;
            }
            return { category: cat, label: meta.label, tone: meta.tone, isIssue: meta.issue, httpStatus, httpLabel };
        })();

        robotsCounts[classification.category] = (robotsCounts[classification.category] || 0) + 1;

        const sizeBytes = rawText ? Buffer.byteLength(rawText, "utf8") : 0;
        robots.push({
            host,
            hasCached: !!rawText,
            robotsTxtPath: rawText ? path.relative(LV_BASE, robotsPath).split(path.sep).join("/") : "",
            rawText: rawText || "",
            linesTotal: decoded ? (decoded.lines?.length || 0) : (rawText ? rawText.split(/\r?\n/).length : 0),
            parsed,
            blacklisted: !!(summary?.blacklist?.[host]),
            blacklistUntil: summary?.blacklist?.[host]?.untilISO || "",
            blacklistReason: summary?.blacklist?.[host]?.reason || "",
            fileName: rawText ? path.basename(robotsPath) : "",
            sizeBytes,
            sizeLabel: formatBytes(sizeBytes),
            statusCategory: classification.category,
            statusLabel: classification.label,
            statusTone: classification.tone,
            httpStatus: classification.httpStatus ?? null,
            httpLabel: classification.httpLabel || "",
            isIssue: classification.isIssue,
            preview: truncatePreview(rawText, 360)
        });
    }

    const robotsMetrics = {
        total: robots.length,
        issues: robots.filter((r) => r.isIssue).length,
        breakdown: makeBreakdown(robotsCounts, ROBOTS_CATEGORY_META, robots.length)
    };

    const docsMetrics = {
        total: docs.length,
        issues: docs.filter((d) => d.isIssue).length,
        breakdown: makeBreakdown((() => {
            const counts = Object.create(null);
            for (const d of docs) counts[d.statusCategory] = (counts[d.statusCategory] || 0) + 1;
            return counts;
        })(), DOC_CATEGORY_META, docs.length)
    };

    return {
        baseHref: "/content/projects/lv-images/generated/lv/",
        summary: summary || {},
        sitemaps,
        docs,
        robots,
        sample: await sampleItems(ITEMS_DIR, 60),
        metrics: { robots: robotsMetrics, docs: docsMetrics }
    };
}
