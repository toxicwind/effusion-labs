// test-sitemap.mjs — Playwright-only sitemap fetch debugger
// Usage: node test-sitemap.mjs [URL]

import { chromium } from "playwright";
import { resolveChromium } from "./tools/resolve-chromium.mjs";
import { gunzipSync } from "node:zlib";

// ---------- config ----------
const TARGET =
    process.argv[2] ||
    "https://us.louisvuitton.com/content/louisvuitton/sitemap/eng_US/sitemap-image.xml";

const USER_AGENT =
    "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0";
const TIMEOUT_MS = 10000;

// A few header profiles to test servers/CDNs that vary on Accept / UA
const PROFILES = [
    {
        key: "pw:xml_strict",
        headers: {
            "user-agent": USER_AGENT,
            accept: "application/xml,text/xml;q=0.9,*/*;q=0.2",
            "accept-language": "en-US,en;q=0.8",
            "cache-control": "no-cache",
            pragma: "no-cache",
        },
    },
    {
        key: "pw:xml_firefoxish",
        headers: {
            "user-agent": USER_AGENT,
            accept: "application/xml,text/xml;q=0.9,text/plain;q=0.5,*/*;q=0.2",
            "accept-language": "en-US,en;q=0.8",
            "cache-control": "no-cache",
            pragma: "no-cache",
        },
    },
    {
        key: "pw:browser_htmly",
        headers: {
            "user-agent": USER_AGENT,
            accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.8",
        },
    },
    {
        key: "pw:curl_any",
        headers: {
            "user-agent": "curl/8.6.0",
            accept: "*/*",
        },
    },
];

// ---------- helpers ----------
const fmtBytes = (n) =>
    n == null ? "-" : n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}KB`;

function isHtmlLike(text, ct = "") {
    return /html/i.test(ct) || /^<!doctype html/i.test(text) || /<html[\s>]/i.test(text);
}
function isXmlLike(text, ct = "") {
    const t = (text || "").trimStart();
    return /xml/i.test(ct) || t.startsWith("<?xml") || /<(urlset|sitemapindex)\b/i.test(t);
}
function detectFormat(text, ct = "") {
    if (isHtmlLike(text, ct)) return "html";
    if (isXmlLike(text, ct)) return "xml";
    if (/text\/plain/i.test(ct)) return "txt";
    return "bin";
}
function isAccessDeniedHtml(text = "") {
    const t = (text || "").toLowerCase();
    return (
        /access(?:\s|-)denied/.test(t) ||
        /forbidden/.test(t) ||
        /unauthorized/.test(t) ||
        /akamai/.test(t) ||
        /you don't have permission/.test(t) ||
        /reference\s*#\w+/i.test(text)
    );
}
function sniffSitemapKind(xml) {
    if (!xml) return "none";
    if (/<sitemapindex\b/i.test(xml)) return "index";
    if (/<urlset\b/i.test(xml) && /<image:/i.test(xml)) return "image";
    if (/<urlset\b/i.test(xml)) return "page";
    return "other";
}
function sampleLocs(xml, n = 3) {
    const out = [];
    const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
    let m;
    while ((m = re.exec(xml)) && out.length < n) out.push(m[1]);
    return out;
}
function countImageEntries(xml) {
    let c = 0;
    const re = /<image:(?:image|loc)\b/gi;
    while (re.exec(xml)) c++;
    return c;
}
function gunzipIfNeeded(buf, headers) {
    const ce = (headers["content-encoding"] || "").toLowerCase();
    const ct = (headers["content-type"] || "").toLowerCase();
    const gzByHeader = /\bgzip\b/.test(ce) || /application\/x-gzip|gzip/i.test(ct);
    const gzMagic = buf?.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    if (gzByHeader || gzMagic) {
        try {
            return gunzipSync(buf);
        } catch {
            return buf; // fall back
        }
    }
    return buf;
}

// ---------- runner ----------
async function run() {
    console.log(`=== sitemap debugger for ${TARGET} ===\n`);
    const browser = await chromium.launch({
        headless: true,
        executablePath: resolveChromium(),
    });
    const ctx = await browser.newContext({
        userAgent: USER_AGENT,
        ignoreHTTPSErrors: true,
    });

    for (const prof of PROFILES) {
        const hdrs = { ...prof.headers };
        const label = prof.key.padEnd(14, " ");

        // HEAD probe
        let headStatus = "-";
        let headCT = "-";
        let headCL = "-";
        try {
            const h = await ctx.request.head(TARGET, { headers: hdrs, timeout: TIMEOUT_MS });
            headStatus = h.status();
            const hh = h.headers();
            headCT = hh["content-type"] || "-";
            headCL = hh["content-length"] || "-";
        } catch { /* ignore */ }

        // GET probe
        let status = 0;
        let ct = "";
        let text = "";
        let bytes = 0;
        let fmt = "bin";
        let notes = [];

        try {
            const resp = await ctx.request.get(TARGET, { headers: hdrs, timeout: TIMEOUT_MS });
            status = resp.status();
            const headers = resp.headers();
            ct = headers["content-type"] || "";
            let body = await resp.body();
            bytes = body?.length || 0;
            body = gunzipIfNeeded(body, headers);
            text = body.toString("utf8");
            fmt = detectFormat(text, ct);

            if (fmt === "html" && isAccessDeniedHtml(text)) notes.push("access-denied-ish");
            if (/security\.txt|vdp|vulnerability disclosure/i.test(text)) notes.push("security-banner-ish");
        } catch (e) {
            notes.push(`error:${e?.message || e}`);
        }

        // quick parse for kind & sample <loc> for xml
        let kind = "-";
        let imgCount = 0;
        let locs = [];
        if (fmt === "xml") {
            kind = sniffSitemapKind(text);
            if (kind === "image") imgCount = countImageEntries(text);
            locs = sampleLocs(text, 3);
        }

        const fmtTag = `${String(fmt).padEnd(4, " ")}`;
        const szTag = `${fmtBytes(bytes).padStart(7, " ")}`;
        const ctShort = (ct || "-").split(";")[0];

        console.log(
            `${label} ${String(status).padEnd(3, " ")} ${fmtTag} ${szTag}  ${ctShort}${notes.length ? "  (" + notes.join(", ") + ")" : ""}`
        );
        console.log(`  • GET  ${TARGET}`);
        if (headStatus !== "-")
            console.log(`  • HEAD status=${headStatus} ct=${headCT} len=${headCL}`);

        if (fmt === "xml") {
            console.log(`  • kind=${kind}${kind === "image" ? ` images≈${imgCount}` : ""}`);
            if (locs.length) console.log(`  • locs: ${locs.join(" | ")}`);
        } else {
            const snippet = (text || "").replace(/\s+/g, " ").slice(0, 180);
            console.log(`  • snippet: ${snippet || "(empty)"}`);
        }
        console.log();
    }

    console.log("Tips:");
    console.log("- If only the xml_strict/firefoxish profiles succeed, keep those Accept headers in your crawler.");
    console.log("- If you see HTML with 'Access Denied', a WAF/CDN is gating based on headers or client.");
    console.log("- If HEAD differs from GET, cache rules or content-encoding might be odd.\n");

    await ctx.close();
    await browser.close();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
