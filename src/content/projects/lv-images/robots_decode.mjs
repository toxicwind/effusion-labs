// robots_decode.mjs — decodes robots.txt into rich JSON (regex, examples, overlaps, crawl-delay)

const ESCAPE_RX = /[.*+?^${}()|[\]\\]/g;
const escapeRegex = (s) => s.replace(ESCAPE_RX, "\\$&");

function normalizeDirective(k) {
    if (!k) return null;
    const key = String(k).trim().toLowerCase();
    if (key === "user-agent" || key === "useragent") return "user-agent";
    if (key === "disallow") return "disallow";
    if (key === "allow") return "allow";
    if (key === "noindex") return "noindex"; // non-standard, keep it
    if (key === "sitemap") return "sitemap";
    if (key === "crawl-delay" || key === "crawldelay") return "crawl-delay";
    return "unknown";
}

function lineType(raw) {
    if (!raw || /^\s*$/.test(raw)) return "blank";
    if (/^\s*#/.test(raw)) return "comment";
    if (/^\s*[A-Za-z-]+\s*:/.test(raw)) return "directive";
    return "malformed";
}

function splitKV(raw) {
    const m = raw.match(/^\s*([A-Za-z-]+)\s*:\s*(.+?)\s*$/);
    if (!m) return null;
    return { key: m[1], value: m[2] };
}

function patternToRegexSource(v) {
    const val = String(v || "");
    if (/^https?:\/\//i.test(val)) {
        const parts = val.split("*").map(escapeRegex);
        return "^" + parts.join(".*") + "$";
    }
    const escaped = val.split("*").map(escapeRegex).join(".*");
    return "^" + (escaped.startsWith("/") ? "" : "/") + escaped;
}

function guessExampleFromPattern(val, origin) {
    const base = new URL(origin);
    let path = "/x";
    const v = String(val || "");

    const withQS = (pathname, k, defaultValue) => {
        const url = new URL(base);
        url.pathname = pathname;
        url.searchParams.set(k, defaultValue);
        return url.toString();
    };

    if (/^https?:\/\//i.test(v)) {
        let u = v.replace(/\*/g, "x");
        u = u.replace(/=($|[^&]+)/g, (m) => (m.endsWith("=") ? "=x" : m));
        return u;
    }

    if (v.startsWith("/eng-us/search")) return withQS("/eng-us/search", "q", "belt");
    if (/\/exclusive-access\/?$/.test(v)) { const u = new URL(base); u.pathname = "/exclusive-access/"; return u.toString(); }
    if (/\/eng-us\/mylv\/?$/.test(v)) { const u = new URL(base); u.pathname = "/eng-us/mylv/"; return u.toString(); }
    if (/\/mylv\/newsletter/i.test(v)) { const u = new URL(base); u.pathname = "/mylv/newsletter"; return u.toString(); }
    if (/page-\*/i.test(v)) { const u = new URL(base); u.pathname = "/collection/page-2"; return u.toString(); }
    if (/lvxmurakami/i.test(v)) { const u = new URL(base); u.pathname = "/collections/lvxmurakami"; return u.toString(); }

    if (/\/mylv\/booking-appointments/i.test(v) && /storeId=/.test(v))
        return withQS("/mylv/booking-appointments", "storeId", "1001");

    if (/\?/.test(v)) {
        const url = new URL(base);
        if (v.startsWith("*/")) url.pathname = "/x/" + v.split("*/")[1].split("?")[0];
        else if (v.startsWith("/*")) url.pathname = "/x";
        else if (v.startsWith("/")) url.pathname = v.split("?")[0];
        else url.pathname = "/x";

        const qs = v.split("?")[1] || "";
        const first = qs.split("&")[0];
        const [k, tail] = first.split("=");
        const defaultMap = { search: "wallet", sort: "price_asc", kitID: "12345", storeId: "1001", personalizationId: "abc123" };
        const valGuess = !tail || tail === "" ? (defaultMap[k] || "x") : tail.replace(/\*/g, "x");
        if (k) url.searchParams.set(k, valGuess);
        return url.toString();
    }

    if (v.startsWith("*/")) path = "/x/" + v.slice(2).replace(/\*/g, "x");
    else if (v.startsWith("/*")) path = "/x" + v.slice(2).replace(/\*/g, "x");
    else if (v.startsWith("/")) path = v.replace(/\*/g, "x");
    else path = "/" + v.replace(/\*/g, "x");

    if (/\/$/.test(v) && !path.endsWith("/")) path += "/";

    const url = new URL(base);
    url.pathname = path;
    return url.toString();
}

function interpret(val) {
    const raw = String(val || "");
    const info = {
        hasWildcard: raw.includes("*"),
        hasQuery: raw.includes("?"),
        pathLike: !/^https?:\/\//i.test(raw),
        endsWithEquals: /=\s*$/.test(raw),
    };
    if (info.hasQuery) info.queryKeys = (raw.split("?")[1] || "")
        .split("&").map((s) => s.split("=")[0]).filter(Boolean);
    if (info.pathLike) {
        info.anchor = raw.startsWith("/") ? "site-root-or-below" : "unknown";
        if (raw.startsWith("*/")) info.scope = "any-subpath";
        else if (raw.startsWith("/*")) info.scope = "any-top-path";
        else if (raw.startsWith("/")) info.scope = "absolute-path";
    } else {
        info.scope = "absolute-url";
    }
    return info;
}

export function decodeRobots(robotsText, origin) {
    const lines = String(robotsText || "").split(/\r?\n/);
    const outLines = [];
    const groups = []; // {userAgents: string[], rules: [], sitemaps: []}
    let currentUAs = [];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const type = lineType(raw);
        const rec = { n: i + 1, raw, type };
        if (type !== "directive") {
            outLines.push(rec);
            continue;
        }
        const kv = splitKV(raw);
        if (!kv) {
            rec.directive = "unknown";
            outLines.push(rec);
            continue;
        }
        const directive = normalizeDirective(kv.key);
        const value = kv.value;

        rec.directive = directive;
        rec.value = value;

        if (directive === "user-agent") {
            currentUAs = [value.trim()];
            groups.push({ userAgents: [...currentUAs], rules: [], sitemaps: [] });
        } else if (directive === "sitemap") {
            if (!groups.length) groups.push({ userAgents: ["*"], rules: [], sitemaps: [] });
            groups[groups.length - 1].sitemaps.push(value.trim());
        } else if (directive === "allow" || directive === "disallow" || directive === "noindex" || directive === "crawl-delay") {
            if (!groups.length) groups.push({ userAgents: ["*"], rules: [], sitemaps: [] });
            const info = interpret(value);
            const rule = { type: directive, value, info };
            if (directive !== "crawl-delay") {
                rule.regex = patternToRegexSource(value);
                rule.example = guessExampleFromPattern(value, origin);
            }
            groups[groups.length - 1].rules.push(rule);
        }
        outLines.push(rec);
    }

    const sitemaps = [];
    const allows = [];
    const disallows = [];
    const noindexes = [];
    let crawlDelay = null;

    for (const g of groups) {
        sitemaps.push(...g.sitemaps);
        for (const r of g.rules) {
            if (r.type === "allow") allows.push(r);
            else if (r.type === "disallow") disallows.push(r);
            else if (r.type === "noindex") noindexes.push(r);
            else if (r.type === "crawl-delay") {
                const n = Number(r.value);
                if (!Number.isNaN(n)) crawlDelay = crawlDelay == null ? n : Math.min(crawlDelay, n);
            }
        }
    }

    const overlaps = [];
    for (const a of allows) {
        const path = (a.example || "").replace(/^https?:\/\/[^/]+/i, "");
        for (const d of disallows) {
            const rx = new RegExp(d.regex);
            if (rx.test(path)) {
                overlaps.push({
                    allow_value: a.value,
                    allow_example: a.example,
                    disallow_value: d.value,
                    disallow_regex: d.regex,
                    note: "Allow appears to carve an exception inside a broader Disallow"
                });
            }
        }
    }

    return {
        meta: {
            origin,
            parsedAt: new Date().toISOString(),
            notes: [
                "Noindex inside robots.txt is non-standard; captured verbatim for analysis.",
                "Regexes are heuristic translations of robots patterns; crawler behavior may differ by vendor."
            ]
        },
        lines: outLines,
        groups,
        summary: {
            sitemaps,
            counts: {
                groups: groups.length,
                allows: allows.length,
                disallows: disallows.length,
                noindexes: noindexes.length,
                sitemaps: sitemaps.length,
                crawlDelay: crawlDelay == null ? 0 : 1
            },
            crawlDelay,
            overlaps
        }
    };
}

// CLI: `curl -s https://example.com/robots.txt | node robots_decode.mjs --origin https://example.com > decoded.json`
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = new Map(process.argv.slice(2).map((x) => (x.includes("=") ? x.split("=") : [x, true])));
    const origin = args.get("--origin") || "https://example.com";
    const { stdin } = process;
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => (data += chunk));
    stdin.on("end", () => {
        const decoded = decodeRobots(data, origin);
        process.stdout.write(JSON.stringify(decoded, null, 2));
    });
}
