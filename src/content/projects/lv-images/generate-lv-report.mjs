#!/usr/bin/env node
import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * LV Image Atlas — Aesthetic, data-driven HTML report
 * - Clickable robots rules (Allow/Disallow/Noindex) with live probe links
 * - Every saved XML/TXT (live + cached links)
 * - Sitemaps grouped and filterable by type (image/product/content/catalog/other)
 * - Sample image wall from NDJSON shards
 * No runtime deps. Everything read from your crawler's outputs.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Inputs produced by your crawler ----
const GEN_DIR = path.join(__dirname, "generated", "lv");
const CACHE_DIR = path.join(GEN_DIR, "cache");
const ROBOTS_DIR = path.join(CACHE_DIR, "robots");
const SITEMAPS_DIR = path.join(CACHE_DIR, "sitemaps");
const ITEMS_DIR = path.join(GEN_DIR, "items");

const SUMMARY_JSON = path.join(GEN_DIR, "summary.json");
const URLMETA_JSON = path.join(CACHE_DIR, "urlmeta.json");
const BLACKLIST_JSON = path.join(GEN_DIR, "hosts", "blacklist.json");

// ---- Output ----
const REPORT_HTML = path.join(GEN_DIR, "report.html");

// ---- Utensils ----
async function loadJSON(p, fb) {
    try { return JSON.parse(await fs.readFile(p, "utf8")); }
    catch { return fb; }
}
const relFromReport = (abs) =>
    path.relative(path.dirname(REPORT_HTML), abs).split(path.sep).join("/");
const num = (n) => (n || 0).toLocaleString();

// Reverse: cachedPath → { url, status, contentType? }
function buildReverseUrlmeta(urlmeta) {
    const m = new Map();
    for (const [u, v] of Object.entries(urlmeta || {})) {
        if (v?.path) m.set(path.resolve(v.path), { url: u, status: v.status ?? "", contentType: v.contentType || "" });
    }
    return m;
}

// Read NDJSON shards for small image sample
async function sampleItems(dir, max = 60) {
    const out = [];
    try {
        const names = (await fs.readdir(dir)).filter(n => n.endsWith(".ndjson")).sort();
        for (const name of names) {
            const full = path.join(dir, name);
            // read first ~1.5MB
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

// Walk a directory recursively (shallow on large trees)
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

// Best-effort robots.txt parser → { host, groups:{agent:[{type,path}]}, merged:{allow,disallow,noindex,crawlDelay}, lines:int }
function parseRobots(text) {
    const groups = []; // [{agents:Set<string>, rules:[{type,path}]}]
    let cur = null;
    const lines = (text || "").split(/\r?\n/);
    const rawRules = [];

    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const m = line.match(/^([A-Za-z\-]+)\s*:\s*(.+)$/);
        if (!m) continue;
        const key = m[1].toLowerCase();
        const val = m[2].trim();

        if (key === "user-agent") {
            cur = { agents: new Set([val.toLowerCase()]), rules: [] };
            groups.push(cur);
            continue;
        }
        if (!cur) {
            // header rule before any UA: group; create a default all-user group
            cur = { agents: new Set(["*"]), rules: [] };
            groups.push(cur);
        }

        if (key === "allow" || key === "disallow" || key === "noindex") {
            cur.rules.push({ type: key, path: val });
            rawRules.push({ type: key, path: val });
        } else if (key === "crawl-delay") {
            cur.rules.push({ type: "crawl-delay", path: val });
            rawRules.push({ type: "crawl-delay", path: val });
        } else if (key === "sitemap") {
            // handled elsewhere (we store via urlmeta), but keep as raw if you want to render too
            cur.rules.push({ type: "sitemap", path: val });
            rawRules.push({ type: "sitemap", path: val });
        }
    }

    // Merge a synthetic * group with coalesced allow/disallow/noindex + min crawl-delay
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
    return { groups, merged, lines: rawRules.length };
}

// Turn a robots pattern (may contain *, $, query) into a plausible “probe URL” you can click
function robotsPatternToUrl(host, pattern) {
    try {
        let p = pattern || "/";
        // strip anchors and wildcards but keep direction
        p = p.replace(/\$/g, "");
        // if it’s a full URL already, just return it
        try {
            const u = new URL(p);
            return u.toString();
        } catch { }
        // ensure leading slash
        if (!p.startsWith("/")) p = "/" + p;
        // replace sequences of * with nothing; collapse //; encode spaces
        p = p.replace(/\*+/g, "").replace(/\/{2,}/g, "/");
        const url = new URL(`https://${host}${p}`);
        return url.toString();
    } catch {
        return `https://${host}/`;
    }
}

// Classify sitemap type from URL
function classifySitemap(url) {
    const u = String(url).toLowerCase();
    if (u.includes("sitemap-image")) return "image";
    if (u.includes("sitemap-product")) return "product";
    if (u.includes("sitemap-content")) return "content";
    if (u.includes("sitemap-catalog")) return "catalog";
    if (u.endsWith("/sitemap.xml") || /\/sitemap[^/]*\.xml(\.gz)?$/.test(u)) return "index";
    return "other";
}

function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

// ---- MAIN ----
async function main() {
    // ensure paths exist
    await fs.mkdir(path.dirname(REPORT_HTML), { recursive: true });

    const [summary, urlmeta, blacklist] = await Promise.all([
        loadJSON(SUMMARY_JSON, {}),
        loadJSON(URLMETA_JSON, {}),
        loadJSON(BLACKLIST_JSON, {})
    ]);

    const rev = buildReverseUrlmeta(urlmeta);

    // Build sitemaps rows (from summary.sitemaps + urlmeta for path/status)
    const sitemapsLog = Array.isArray(summary?.sitemaps) ? summary.sitemaps : [];
    const sitemapsRows = sitemapsLog.map(s => {
        const um = urlmeta[s.url] || {};
        return {
            host: s.host || "",
            url: s.url,
            type: classifySitemap(s.url),
            imageCount: s.imageCount || 0,
            status: um.status ?? "",
            savedPath: um.path ? relFromReport(path.resolve(um.path)) : "",
        };
    });

    // Scan cached XML/TXT (everything under cache/sitemaps)
    const docs = [];
    for await (const p of walk(SITEMAPS_DIR)) {
        if (!/\.(xml|txt|gz)$/i.test(p)) continue;
        const meta = rev.get(path.resolve(p)) || {};
        const host = (() => { try { return new URL(meta.url).host; } catch { return path.basename(path.dirname(p)); } })();
        const type = /\.xml(\.gz)?$/i.test(p) ? "xml" : /\.txt$/i.test(p) ? "txt" : "gz";
        docs.push({
            host,
            kind: type,
            url: meta.url || "",
            status: meta.status ?? "",
            contentType: meta.contentType || "",
            savedPath: relFromReport(path.resolve(p))
        });
    }
    docs.sort((a, b) => a.host.localeCompare(b.host) || a.savedPath.localeCompare(b.savedPath));

    // Parse robots from cached files (clickable rules)
    const robotsRows = [];
    try {
        const files = (await fs.readdir(ROBOTS_DIR)).filter(n => n.endsWith(".txt"));
        for (const name of files) {
            const full = path.join(ROBOTS_DIR, name);
            const host = name.replace(/\.txt$/i, "");
            const text = await fs.readFile(full, "utf8");
            const parsed = parseRobots(text);
            const bl = blacklist[host];
            robotsRows.push({
                host,
                robotsTxtPath: relFromReport(full),
                lines: parsed.lines,
                crawlDelay: parsed.merged.crawlDelay,
                allow: parsed.merged.allow.map(p => ({ pattern: p, link: robotsPatternToUrl(host, p) })),
                disallow: parsed.merged.disallow.map(p => ({ pattern: p, link: robotsPatternToUrl(host, p) })),
                noindex: parsed.merged.noindex.map(p => ({ pattern: p, link: robotsPatternToUrl(host, p) })),
                sitemapsFromRobots: parsed.merged.sitemaps || [],
                blacklisted: !!bl,
                blacklistUntil: bl?.untilISO || "",
                blacklistReason: bl?.reason || ""
            });
        }
        robotsRows.sort((a, b) => a.host.localeCompare(b.host));
    } catch { }

    // Sample some images
    const sample = await sampleItems(ITEMS_DIR, 60);

    // Build HTML
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>LV Image Atlas — Report</title>
<style>
:root{
  --bg:#0b0f14; --panel:#10161c; --muted:#9fb0c3; --text:#e6edf3; --brand:#6aa6ff;
  --ok:#26c281; --warn:#ffb020; --bad:#ff5d5d; --chip:#1b2632; --border:#1a2330;
}
*{box-sizing:border-box}
body{margin:0; background:var(--bg); color:var(--text); font:14px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, 'Helvetica Neue', Arial}
a{color:var(--brand); text-decoration:none}
a:hover{text-decoration:underline}
.header{position:sticky; top:0; z-index:20; background:linear-gradient(180deg, rgba(11,15,20,.95), rgba(11,15,20,.75)); border-bottom:1px solid var(--border); backdrop-filter: blur(6px)}
.wrap{max-width:1200px; margin:0 auto; padding:16px 20px}
.hstack{display:flex; align-items:center; gap:12px; flex-wrap:wrap}
.title{font-size:20px; font-weight:700}
.kpis{display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px}
.kpi{background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:14px}
.kpi .label{color:var(--muted); font-size:12px}
.kpi .value{font-size:22px; font-weight:700; margin-top:2px}
.section{margin:22px 0}
.section h2{font-size:16px; margin:0 0 10px 0; color:#d6e2f0}
.card{background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:12px}
.table{width:100%; border-collapse:separate; border-spacing:0}
.table th, .table td{padding:10px 12px; text-align:left; border-bottom:1px solid var(--border)}
.table thead th{position:sticky; top:64px; background:var(--panel); z-index:5; font-size:12px; color:#c9d6e2; text-transform:uppercase; letter-spacing:.03em}
.table tbody tr:hover{background:#0f1720}
.badge{display:inline-block; padding:4px 8px; border-radius:999px; background:var(--chip); color:#c9d6e2; font-size:12px}
.badge.ok{background:rgba(38,194,129,.12); color:#8cf0c8; border:1px solid rgba(38,194,129,.45)}
.badge.bad{background:rgba(255,93,93,.12); color:#ffb3b3; border:1px solid rgba(255,93,93,.45)}
.badge.type{background:#0c1219; border:1px solid var(--border)}
.input{padding:9px 12px; background:#0c1219; border:1px solid var(--border); color:var(--text); border-radius:10px; width:280px}
.grid{display:grid; grid-template-columns:repeat(6,1fr); gap:8px}
.thumb{position:relative; border-radius:12px; overflow:hidden; background:#0c1219; border:1px solid var(--border); aspect-ratio:1/1}
.thumb img{width:100%; height:100%; object-fit:cover; display:block; filter:saturate(1.02)}
.small{font-size:12px; color:var(--muted)}
.tools{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
hr{border:0;border-top:1px solid var(--border); margin:14px 0}
.chips{display:flex; gap:6px; flex-wrap:wrap}
.code{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size:12px; background:#0b1218; border:1px solid var(--border); padding:8px 10px; border-radius:10px; color:#b9cadd}
.pill{padding:6px 10px; border:1px solid var(--border); background:#0c1219; color:#cfe3ff; border-radius:999px; cursor:pointer}
.pill.active{background:#0f1620; border-color:#24405e}
.rule-list{display:flex; gap:6px; flex-wrap:wrap}
.rule{display:inline-flex; align-items:center; gap:6px; font-size:12px; background:#0c1219; border:1px solid var(--border); padding:4px 8px; border-radius:999px}
.rule .kind{opacity:.8}
.rule .sep{opacity:.35}
.grid-robots{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px}
@media (max-width: 1000px){ .grid-robots{grid-template-columns:1fr} }
</style>
</head>
<body>
<header class="header">
  <div class="wrap hstack">
    <div class="title">LV Image Atlas — Report</div>
    <div class="chips">
      <span class="badge">Generated: ${escapeHtml(summary?.generatedAt || new Date().toISOString())}</span>
      <span class="badge">Version: ${escapeHtml(String(summary?.version ?? "n/a"))}</span>
      <span class="badge">Items: ${num(summary?.totals?.items || 0)}</span>
      <span class="badge">Pages: ${num(summary?.totals?.pages || 0)}</span>
    </div>
  </div>
</header>

<main class="wrap">

  <section class="section">
    <h2>Hosts & Sitemaps</h2>
    <div class="tools">
      <input id="sitemapFilter" class="input" placeholder="Filter by host / URL…">
      <div class="chips" id="typeChips">
        ${["image", "product", "content", "catalog", "index", "other"].map(t => `<button class="pill" data-type="${t}">${t}</button>`).join("")}
      </div>
      <button class="pill" id="exportSitemaps">Export sitemaps CSV</button>
    </div>
    <div class="card">
      <table class="table" id="sitemapsTable">
        <thead><tr>
          <th>Host</th>
          <th>Type</th>
          <th>Images</th>
          <th>Status</th>
          <th>Live URL</th>
          <th>Cached</th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <h2>Robots Explorer</h2>
    <div class="tools">
      <input id="robotsFilter" class="input" placeholder="Filter hosts…">
      <button class="pill" id="toggleBlacklisted">Toggle blacklisted</button>
    </div>
    <div class="card" id="robotsContainer"></div>
  </section>

  <section class="section">
    <h2>All saved XML/TXT</h2>
    <div class="tools">
      <input id="docsFilter" class="input" placeholder="Filter host / URL / content-type…">
      <button class="pill" id="exportDocs">Export docs CSV</button>
    </div>
    <div class="card">
      <table class="table" id="docsTable">
        <thead><tr>
          <th>Host</th>
          <th>Kind</th>
          <th>Status</th>
          <th>Content-Type</th>
          <th>Live URL</th>
          <th>Cached</th>
        </tr></thead>
        <tbody></tbody>
      </table>
      <div class="small" style="margin-top:8px">Every cached document under <span class="code">cache/sitemaps/</span> is listed. “Live URL” comes from <span class="code">urlmeta.json</span> when present.</div>
    </div>
  </section>

  <section class="section">
    <h2>Image sample</h2>
    <div class="card">
      <div class="grid">
        ${sample.map(i => `
          <a class="thumb" href="${escapeAttr(i.src)}" target="_blank" title="${escapeAttr(i.title || i.src)}">
            <img loading="lazy" src="${escapeAttr(i.src)}" alt="">
          </a>
        `).join("")}
      </div>
      <div class="small" style="margin-top:10px">Showing ${sample.length} sample images from NDJSON shards.</div>
    </div>
  </section>

  <section class="section">
    <h2>Run snapshot</h2>
    <div class="card">
      <pre class="code">${escapeHtml(JSON.stringify({
        version: summary?.version,
        generatedAt: summary?.generatedAt,
        config: summary?.config || {},
        outputs: summary?.outputs || {}
    }, null, 2))}</pre>
    </div>
  </section>

</main>

<script>
const SITEMAPS = ${JSON.stringify(sitemapsRows)};
const ROBOTS   = ${JSON.stringify(robotsRows)};
const DOCS     = ${JSON.stringify(docs)};

const qs = (s, el=document)=>el.querySelector(s);
const qsa= (s, el=document)=>Array.from(el.querySelectorAll(s));
function cell(html){ const td=document.createElement('td'); td.innerHTML = html; return td; }
function row(cells){ const tr=document.createElement('tr'); cells.forEach(c=>tr.appendChild(c)); return tr; }
function link(url, text){ return url ? '<a href="'+escapeAttr(String(url))+'" target="_blank" rel="noreferrer">'+escapeHtml(String(text||url))+'</a>' : '—'; }
function badge(t,cls="badge"){ return '<span class="'+cls+'">'+escapeHtml(String(t))+'</span>'; }
function num(n){ return (n||0).toLocaleString(); }
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escapeAttr(s){return escapeHtml(s);}
function toCSV(rows, headers){
  const esc = v => {
    if (v == null) return '';
    const s = String(v).replace(/"/g,'""');
    return /[",\n]/.test(s) ? '"'+s+'"' : s;
  };
  const out = [headers.join(",")].concat(rows.map(r => headers.map(h => esc(r[h])).join(",")));
  return out.join("\\n");
}

// -------- Sitemaps table with type filters --------
const typeState = new Set(["image","product","content","catalog","index","other"]);
function renderSitemaps(filter=""){
  const tb = qs('#sitemapsTable tbody'); tb.innerHTML = "";
  const f = (filter || "").toLowerCase().trim();
  SITEMAPS
    .filter(r => typeState.has(r.type))
    .filter(r => !f || (r.host.toLowerCase().includes(f) || r.url.toLowerCase().includes(f)))
    .sort((a,b) => (a.type===b.type ? 0 : (a.type==="image"?-1:1)) || a.host.localeCompare(b.host) || a.url.localeCompare(b.url))
    .forEach(r => {
      const typeChip = '<span class="badge type">'+escapeHtml(r.type)+'</span>';
      tb.appendChild(row([
        cell(escapeHtml(r.host)),
        cell(typeChip),
        cell(num(r.imageCount || 0)),
        cell(String(r.status||"")),
        cell(link(r.url, r.url)),
        cell(r.savedPath ? link(r.savedPath, "open") : "—")
      ]));
    });
}
qsa('#typeChips .pill').forEach(btn => {
  btn.classList.add("active");
  btn.addEventListener('click', () => {
    const t = btn.dataset.type;
    if (typeState.has(t)) { typeState.delete(t); btn.classList.remove("active"); }
    else { typeState.add(t); btn.classList.add("active"); }
    renderSitemaps(qs('#sitemapFilter').value);
  });
});
qs('#sitemapFilter').addEventListener('input', e => renderSitemaps(e.target.value));
qs('#exportSitemaps').addEventListener('click', () => {
  const filtered = SITEMAPS.filter(r => typeState.has(r.type));
  const csv = toCSV(filtered, ["host","type","imageCount","status","url","savedPath"]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
  a.download = "sitemaps.csv"; document.body.appendChild(a); a.click(); a.remove();
});

// -------- Robots Explorer (clickable rule probes) --------
let showBlacklisted = true;
function renderRobots(filter=""){
  const f = (filter||"").toLowerCase().trim();
  const cont = qs('#robotsContainer'); cont.innerHTML = "";
  ROBOTS
    .filter(r => (showBlacklisted || !r.blacklisted))
    .filter(r => !f || r.host.toLowerCase().includes(f))
    .forEach(r => {
      const hdr = \`<div class="hstack" style="justify-content:space-between;gap:10px;margin-bottom:8px">
        <div class="hstack" style="gap:8px">
          <div style="font-weight:700">\${escapeHtml(r.host)}</div>
          <div class="chips">
            <span class="badge">lines \${num(r.lines||0)}</span>
            \${r.crawlDelay!=null ? '<span class="badge">delay '+escapeHtml(r.crawlDelay)+'</span>' : ''}
            \${r.blacklisted ? '<span class="badge bad">blacklisted '+escapeHtml(r.blacklistReason||'')+'</span>' : '<span class="badge ok">ok</span>'}
          </div>
        </div>
        <div class="hstack" style="gap:8px">
          \${r.robotsTxtPath ? link(r.robotsTxtPath, "robots.txt (cached)") : ""}
        </div>
      </div>\`;

      const rules = (label, arr, cls) => {
        if (!arr || !arr.length) return '';
        return \`<div style="margin:6px 0 10px 0">
          <div class="small" style="margin-bottom:6px;opacity:.9">\${label}</div>
          <div class="rule-list">\${
            arr.map(x => \`<span class="rule">\${cls?'<span class="kind">'+cls+'</span><span class="sep">·</span>':''}<a href="\${escapeAttr(x.link)}" target="_blank">\${escapeHtml(x.pattern||"/")}</a></span>\`).join("")
          }</div>
        </div>\`;
      };

      const sitemapsList = r.sitemapsFromRobots && r.sitemapsFromRobots.length
        ? \`<div class="small">Sitemaps from robots: \${r.sitemapsFromRobots.map(u=>'<a href="'+escapeAttr(u)+'" target="_blank">'+escapeHtml(u)+'</a>').join(' · ')}</div>\`
        : '';

      const card = document.createElement('div');
      card.className = "card";
      card.style.marginBottom = "10px";
      card.innerHTML = hdr + rules("Disallow", r.disallow, "disallow") + rules("Allow", r.allow, "allow") + rules("Noindex", r.noindex, "noindex") + sitemapsList;
      cont.appendChild(card);
    });
}
qs('#robotsFilter').addEventListener('input', e => renderRobots(e.target.value));
qs('#toggleBlacklisted').addEventListener('click', () => { showBlacklisted = !showBlacklisted; renderRobots(qs('#robotsFilter').value); });

// -------- Docs table --------
function renderDocs(filter=""){
  const tb = qs('#docsTable tbody'); tb.innerHTML = "";
  const f = (filter||"").toLowerCase().trim();
  DOCS
    .filter(r => !f || r.host.toLowerCase().includes(f) || (r.url||"").toLowerCase().includes(f) || (r.contentType||"").toLowerCase().includes(f))
    .forEach(r => {
      tb.appendChild(row([
        cell(escapeHtml(r.host)),
        cell(escapeHtml(r.kind||"")),
        cell(String(r.status||"")),
        cell(escapeHtml(r.contentType||"")),
        cell(link(r.url, r.url || "—")),
        cell(r.savedPath ? link(r.savedPath, "open") : "—")
      ]));
    });
}
qs('#docsFilter').addEventListener('input', e => renderDocs(e.target.value));
qs('#exportDocs').addEventListener('click', () => {
  const csv = toCSV(DOCS, ["host","kind","status","contentType","url","savedPath"]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
  a.download = "docs.csv"; document.body.appendChild(a); a.click(); a.remove();
});

// Initial render
renderSitemaps("");
renderRobots("");
renderDocs("");

// helpers for inline templating (scoped)
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escapeAttr(s){return escapeHtml(s);}
</script>

</body>
</html>`;

    await fs.writeFile(REPORT_HTML, html, "utf8");
    console.log("✔ Wrote report →", path.relative(process.cwd(), REPORT_HTML));
}

await main().catch(err => { console.error(err); process.exitCode = 1; });
