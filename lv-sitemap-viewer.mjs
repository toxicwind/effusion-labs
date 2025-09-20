// lv-sitemap-viewer.mjs
// Run:       node lv-sitemap-viewer.mjs
// Output:    lv-all.html  (a single static file with DaisyUI/Tailwind via CDN)
//
// What you get:
// • Aggregates many locale sitemaps (static list below)
// • Dedupe controls (Exact / strip ?query / strip host+query)
// • Facets: filter by locale(s) + host(s)
// • Live search, sort, theme switcher, grid density slider
// • Virtualized-ish incremental rendering (batches) + true lazy image loading (IntersectionObserver)
// • Modal lightbox with metadata + quick links

import fs from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

// ---------- Static knowledge (expand as needed) ----------
const SUBS = [
    "us", "fr", "es", "hk", "in", "eu", "en", "de", "it", "ca", "au", "jp", "kr", "br", "sg"
];
const LOCALES = [
    "eng_US", "fra_FR", "esp_ES", "eng_GB", "eng_HK", "eng_AU", "eng_CA", "eng_E1",
    "deu_DE", "ita_IT", "jpn_JP", "kor_KR", "por_BR", "eng_IN", "eng_SG", "rus_RU"
];
const SITEMAP_URLS = SUBS.flatMap(sub =>
    LOCALES.map(loc =>
        `https://${sub}.louisvuitton.com/content/louisvuitton/sitemap/${loc}/sitemap-image.xml`
    )
);

const OUT_FILE = "lv-all.html";
const CONCURRENCY = 6;

// ---------- Fetch & parse ----------
async function fetchXml(u) {
    const res = await fetch(u, {
        headers: {
            "user-agent": "LV-Sitemap-Viewer/1.3 (+local)",
            "accept": "application/xml,text/xml;q=0.9,*/*;q=0.8",
        },
    });
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${u}`);
    return await res.text();
}

function parseSitemap(xmlText) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        removeNSPrefix: true,
        trimValues: true,
        allowBooleanAttributes: true,
    });
    const root = parser.parse(xmlText);
    const urlset = root.urlset || root.sitemapindex || root;
    const urls = Array.isArray(urlset.url) ? urlset.url : (urlset.url ? [urlset.url] : []);
    const items = [];
    for (const u of urls) {
        const pageUrl = u?.loc || "";
        let imgs = u?.image || u?.["image:image"] || [];
        if (!Array.isArray(imgs)) imgs = [imgs];
        for (const img of imgs) {
            if (!img) continue;
            const src = img.loc || img["image:loc"] || img.url || null;
            if (!src) continue;
            const title = img.title || img["image:title"] || img.caption || img["image:caption"] || "";
            const license = img.license || img["image:license"] || "";
            items.push({ src, title, pageUrl, license });
        }
    }
    return items;
}

function hostOf(u) { try { return new URL(u).host; } catch { return ""; } }
function localeOf(u) { try { const m = new URL(u).pathname.match(/\/sitemap\/([^/]+)\/sitemap-image\.xml$/i); return m ? m[1] : ""; } catch { return ""; } }

async function fetchAllSitemaps(urls) {
    const tasks = urls.map(u => ({ u, host: hostOf(u), locale: localeOf(u) }));
    const results = [];
    let i = 0;

    async function worker() {
        while (i < tasks.length) {
            const j = i++;
            const t = tasks[j];
            try {
                const xml = await fetchXml(t.u);
                const entries = parseSitemap(xml).map(e => ({
                    ...e,
                    _locale: t.locale,
                    _host: t.host,
                    _sitemap: t.u
                }));
                results.push(...entries);
                console.log(`✓ ${t.u}  +${entries.length} items`);
            } catch (err) {
                console.warn(`✗ ${t.u}  ${err.message}`);
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, tasks.length)) }, worker));
    return results;
}

// ---------- HTML ----------
function escapeHtml(s = "") {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function buildHtml({ entries, sourceList }) {
    const now = new Date().toISOString();
    const srcListPretty = sourceList.map(escapeHtml).join("<br>");
    const count = entries.length;

    return `<!doctype html>
<html data-theme="business" lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LV Image Sitemaps — Multi-locale Viewer</title>

<!-- Tailwind + DaisyUI via CDN -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
  window.daisyui = window.daisyui || {};
  tailwind.config = {
    plugins: [daisyui],
    theme: { extend: { colors: {} } },
    darkMode: ['class', '[data-theme="business"]']
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/daisyui@4.12.10/dist/full.min.js"></script>

<style>
  :root { --tile-min: 220px; }
  .grid-auto {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(var(--tile-min), 1fr));
  }
  .skeleton {
    background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06));
    background-size: 200% 100%;
    animation: shimmer 1.2s infinite;
  }
  @keyframes shimmer { 0%{background-position:0% 0} 100%{background-position:-200% 0} }
  .thumb img.loading-blur { filter: blur(16px); transform: scale(1.02); }
  .thumb img.loaded { filter: none; transform:none; transition: filter .25s ease, transform .25s ease; }
  .sticky-top { position: sticky; top: 0; z-index: 40; }
</style>
</head>

<body class="min-h-screen">
  <!-- Navbar -->
  <div class="navbar bg-base-200 sticky-top">
    <div class="flex-1">
      <span class="text-lg font-semibold">Louis Vuitton — Image Sitemaps</span>
    </div>
    <div class="flex-none gap-2">
      <select id="themeSel" class="select select-sm select-bordered">
        <option>business</option>
        <option>luxury</option>
        <option>dim</option>
        <option>dracula</option>
        <option>lofi</option>
        <option>corporate</option>
        <option>forest</option>
      </select>
      <a class="btn btn-sm" href="#filters">Filters</a>
      <button id="exportBtn" class="btn btn-sm">Export JSON</button>
    </div>
  </div>

  <!-- Controls -->
  <section class="p-4 bg-base-100 border-b border-base-200">
    <div class="flex flex-col lg:flex-row gap-3 items-stretch">
      <input id="q" type="search" placeholder="Search title, image URL, page URL, locale, host…" class="input input-bordered w-full" />
      <div class="flex gap-2">
        <select id="view" class="select select-bordered">
          <option value="unique" selected>Unique images (deduped)</option>
          <option value="all">All entries (raw)</option>
        </select>
        <select id="dedup" class="select select-bordered">
          <option value="originless" selected>Dedup: strip host + ?query</option>
          <option value="url">Dedup: strip ?query</option>
          <option value="exact">Dedup: exact URL</option>
        </select>
        <select id="sort" class="select select-bordered">
          <option value="loc-desc">Sort: Locale count (↓)</option>
          <option value="host-desc">Sort: Host count (↓)</option>
          <option value="title-asc">Sort: Title (A→Z)</option>
          <option value="title-desc">Sort: Title (Z→A)</option>
          <option value="page-asc">Sort: Page URL (A→Z)</option>
          <option value="page-desc">Sort: Page URL (Z→A)</option>
          <option value="img-asc">Sort: Image URL (A→Z)</option>
          <option value="img-desc">Sort: Image URL (Z→A)</option>
        </select>
      </div>
      <div class="flex items-center gap-3">
        <label class="label cursor-pointer">
          <span class="label-text mr-2">Grid</span>
          <input id="gridRange" type="range" min="180" max="360" value="240" class="range range-xs" />
        </label>
        <label class="label cursor-pointer">
          <span class="label-text mr-2">Batch</span>
          <input id="batchRange" type="range" min="24" max="144" value="60" class="range range-xs" />
        </label>
        <button id="resetBtn" class="btn btn-outline">Reset</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats stats-vertical lg:stats-horizontal shadow mt-3">
      <div class="stat">
        <div class="stat-title">Generated</div>
        <div class="stat-value text-primary text-lg">${escapeHtml(now)}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Entries (raw)</div>
        <div id="stat-entries" class="stat-value">${count.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Unique</div>
        <div id="stat-unique" class="stat-value">—</div>
      </div>
      <div class="stat">
        <div class="stat-title">Dupe groups</div>
        <div id="stat-dupes" class="stat-value">—</div>
      </div>
    </div>
  </section>

  <!-- Filters -->
  <section id="filters" class="p-4 bg-base-100 border-b border-base-200">
    <div class="collapse collapse-arrow bg-base-200">
      <input type="checkbox" />
      <div class="collapse-title text-md font-medium">
        Filter by locale & host
      </div>
      <div class="collapse-content">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="font-semibold mb-2">Locales</div>
            <div id="facet-locales" class="flex flex-wrap gap-2"></div>
          </div>
          <div>
            <div class="font-semibold mb-2">Hosts</div>
            <div id="facet-hosts" class="flex flex-wrap gap-2"></div>
          </div>
        </div>
        <div class="mt-3">
          <details class="collapse collapse-plus bg-base-300">
            <summary class="collapse-title">Source sitemaps (${sourceList.length})</summary>
            <div class="collapse-content text-xs">
              ${srcListPretty}
            </div>
          </details>
        </div>
      </div>
    </div>
  </section>

  <!-- Grid -->
  <main class="p-4">
    <div id="grid" class="grid-auto" style="--tile-min:240px"></div>
    <div id="empty" class="text-center text-base-content/60 p-8 hidden">No results. Try clearing filters.</div>
    <div id="sentinel" class="h-8"></div>
  </main>

  <!-- Modal (lightbox) -->
  <dialog id="lightbox" class="modal">
    <div class="modal-box max-w-5xl">
      <form method="dialog"><button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button></form>
      <div id="lbContent"></div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>

<script type="module">
const RAW = ${JSON.stringify(entries, null, 2)};

// ——— helpers ———
const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const empty = $('#empty');
const q = $('#q');
const sortSel = $('#sort');
const viewSel = $('#view');
const dedupSel = $('#dedup');
const resetBtn = $('#resetBtn');
const themeSel = $('#themeSel');
const gridRange = $('#gridRange');
const batchRange = $('#batchRange');
const statEntries = $('#stat-entries');
const statUnique = $('#stat-unique');
const statDupes  = $('#stat-dupes');
const sentinel = $('#sentinel');
const exportBtn = $('#exportBtn');
const lb = document.getElementById('lightbox');
const lbContent = document.getElementById('lbContent');

function escape(s){ return String(s ?? "").replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function host(u){ try { return new URL(u).host; } catch { return ""; } }
function pathname(u){ try { return new URL(u).pathname; } catch { return u; } }
function stripQuery(u){ try { const x=new URL(u); x.search=""; x.hash=""; return x.toString(); } catch { return u.split(/[?#]/)[0]; } }
const uniq = (arr) => Array.from(new Set(arr));

function normalize(u, mode) {
  if (mode === 'exact') return String(u || '');
  if (mode === 'originless') return pathname(u);
  return stripQuery(u);
}

function groupByImage(list, mode='originless') {
  const map = new Map();
  for (const it of list) {
    const key = normalize(it.src, mode);
    const g = map.get(key) || {
      key,
      reprSrc: it.src,
      title: it.title || "",
      hosts: new Set(),
      locales: new Set(),
      pages: new Set(),
      entries: []
    };
    if (!g.title && it.title) g.title = it.title;
    g.hosts.add(it._host || host(it.src));
    if (it._locale) g.locales.add(it._locale);
    if (it.pageUrl) g.pages.add(it.pageUrl);
    g.entries.push(it);
    if (g.reprSrc && (g.reprSrc.includes("?") && !it.src.includes("?"))) g.reprSrc = it.src;
    map.set(key, g);
  }
  return Array.from(map.values()).map(g => ({
    ...g,
    hosts: Array.from(g.hosts).sort(),
    locales: Array.from(g.locales).sort(),
    pages: Array.from(g.pages).slice(0, 8),
    pageCount: g.pages.size
  }));
}

// facets
const ALL_LOCALES = uniq(RAW.map(x => x._locale).filter(Boolean)).sort();
const ALL_HOSTS   = uniq(RAW.map(x => x._host).filter(Boolean)).sort();
const facetLocales = new Set();
const facetHosts = new Set();

function makeChip(label, count, active) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-xs ' + (active ? 'btn-primary' : 'btn-outline');
  btn.innerHTML = `${ escape(label) } <span class="badge badge-xs ml-1">${count}</span>`;
  return btn;
}

function renderFacets(groups) {
  const lc = document.getElementById('facet-locales');
  const hc = document.getElementById('facet-hosts');
  lc.innerHTML = ''; hc.innerHTML = '';

  // counts across current set
  const lCount = new Map(); const hCount = new Map();
  for (const g of groups) {
    for (const l of g.locales) lCount.set(l, (lCount.get(l)||0) + 1);
    for (const h of g.hosts)   hCount.set(h, (hCount.get(h)||0) + 1);
  }

  for (const l of ALL_LOCALES) {
    const btn = makeChip(l, lCount.get(l)||0, facetLocales.has(l));
    btn.addEventListener('click', () => { facetLocales.has(l) ? facetLocales.delete(l) : facetLocales.add(l); update(true); });
    lc.appendChild(btn);
  }
  for (const h of ALL_HOSTS) {
    const btn = makeChip(h, hCount.get(h)||0, facetHosts.has(h));
    btn.addEventListener('click', () => { facetHosts.has(h) ? facetHosts.delete(h) : facetHosts.add(h); update(true); });
    hc.appendChild(btn);
  }
}

function passesFacets(itemOrGroup, uniqueMode) {
  const locales = uniqueMode ? (itemOrGroup.locales||[]) : [itemOrGroup._locale].filter(Boolean);
  const hosts   = uniqueMode ? (itemOrGroup.hosts||[])   : [itemOrGroup._host].filter(Boolean);

  if (facetLocales.size && !locales.some(l => facetLocales.has(l))) return false;
  if (facetHosts.size   && !hosts.some(h => facetHosts.has(h)))     return false;
  return true;
}

function sorter(kind) {
  const by = sel => (a,b) => (sel(a)>sel(b))?1:(sel(a)<sel(b)?-1:0);
  switch(kind){
    case 'page-asc':  return by(x => (x.pageUrl || x.pages?.[0] || "").toLowerCase());
    case 'page-desc': return (a,b)=>-by(x => (x.pageUrl || x.pages?.[0] || "").toLowerCase())(a,b);
    case 'img-asc':   return by(x => (x.src || x.reprSrc || "").toLowerCase());
    case 'img-desc':  return (a,b)=>-by(x => (x.src || x.reprSrc || "").toLowerCase())(a,b);
    case 'title-desc':return (a,b)=>-by(x => (x.title || "").toLowerCase())(a,b);
    case 'title-asc': return by(x => (x.title || "").toLowerCase());
    case 'loc-desc':  return (a,b)=> (b.locales?.length||0)-(a.locales?.length||0);
    case 'host-desc': return (a,b)=> (b.hosts?.length||0)-(a.hosts?.length||0);
    default:          return by(x => (x.pageUrl || x.pages?.[0] || "").toLowerCase());
  }
}

function textFilterFn(needle, uniqueMode) {
  if (!needle) return () => true;
  const n = needle.toLowerCase();
  if (uniqueMode) {
    return (g) =>
      (g.title||"").toLowerCase().includes(n) ||
      (g.reprSrc||"").toLowerCase().includes(n) ||
      g.hosts.some(h => h.toLowerCase().includes(n)) ||
      g.locales.some(l => l.toLowerCase().includes(n)) ||
      g.pages.some(p => p.toLowerCase().includes(n));
  } else {
    return (it) =>
      (it.title||"").toLowerCase().includes(n) ||
      (it.src||"").toLowerCase().includes(n) ||
      (it.pageUrl||"").toLowerCase().includes(n) ||
      (it._locale||"").toLowerCase().includes(n) ||
      (it._host||"").toLowerCase().includes(n);
  }
}

// Incremental rendering
let currentList = [];    // the list we should show (groups or entries)
let rendered = 0;        // count rendered so far
function clearGrid() { grid.innerHTML = ''; rendered = 0; }
function nextBatchSize() { return parseInt(batchRange.value, 10) || 60; }

const imgObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      const img = e.target;
      const src = img.getAttribute('data-src');
      if (src && !img.src) {
        img.src = src;
        img.onload = () => { img.classList.remove('loading-blur'); img.classList.add('loaded'); };
      }
      imgObserver.unobserve(img);
    }
  }
}, { rootMargin: '600px' });

function createCard({ t, img, page, hosts, locales, pages, uniqueMode }) {
  const el = document.createElement('article');
  el.className = 'card bg-base-200 border border-base-300 shadow-md';

  const thumb = document.createElement('figure');
  thumb.className = 'thumb aspect-[4/3] overflow-hidden';
  const image = document.createElement('img');
  image.alt = t;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.className = 'w-full h-full object-cover loading-blur';
  image.setAttribute('data-src', img);
  thumb.appendChild(image);

  const body = document.createElement('div');
  body.className = 'card-body p-3 gap-2';
  const title = document.createElement('div');
  title.className = 'text-sm line-clamp-2';
  title.textContent = t || '(untitled)';

  const actions = document.createElement('div');
  actions.className = 'flex gap-2 flex-wrap';
  const aPage = document.createElement('a');
  aPage.href = page || '#';
  aPage.target = '_blank'; aPage.rel = 'noopener';
  aPage.className = 'btn btn-xs';
  aPage.textContent = 'Product/Page';
  const aImg = document.createElement('a');
  aImg.href = img; aImg.target = '_blank'; aImg.rel='noopener';
  aImg.className = 'btn btn-xs btn-outline';
  aImg.textContent = 'Image';
  const aView = document.createElement('button');
  aView.className = 'btn btn-xs btn-primary';
  aView.textContent = 'Details';
  aView.addEventListener('click', () => openLightbox({ t, img, page, hosts, locales, pages }));

  actions.append(aPage, aImg, aView);

  const chips = document.createElement('div');
  chips.className = 'flex gap-1 flex-wrap';
  if (locales?.length) {
    const c = document.createElement('div'); c.className='badge badge-outline'; c.textContent = `Locales: ${ locales.length } `; chips.appendChild(c);
  }
  if (hosts?.length) {
    const c = document.createElement('div'); c.className='badge badge-outline'; c.textContent = `Hosts: ${ hosts.length } `; chips.appendChild(c);
  }
  if (pages?.length) {
    const c = document.createElement('div'); c.className='badge badge-outline'; c.textContent = `${ pages.length } page${ pages.length > 1 ? 's' : '' } `; chips.appendChild(c);
  }

  const src = document.createElement('a');
  src.href = img; src.target='_blank'; src.rel='noopener';
  src.className = 'text-xs text-base-content/60 break-all';
  src.textContent = img;

  body.append(title, actions, chips, src);
  el.append(thumb, body);

  imgObserver.observe(image);
  return el;
}

function appendBatch() {
  const B = nextBatchSize();
  const end = Math.min(rendered + B, currentList.length);
  for (let i = rendered; i < end; i++) {
    const it = currentList[i];
    const uniqueMode = viewSel.value === 'unique';
    const t = (it.title || '').trim() || '(untitled)';
    const img = uniqueMode ? it.reprSrc : it.src;
    const page = uniqueMode ? (it.pages?.[0] || '#') : (it.pageUrl || '#');
    const hosts = uniqueMode ? it.hosts : [it._host].filter(Boolean);
    const locales = uniqueMode ? it.locales : [it._locale].filter(Boolean);
    const pages = uniqueMode ? it.pages : (it.pageUrl ? [it.pageUrl] : []);

    grid.appendChild(createCard({ t, img, page, hosts, locales, pages, uniqueMode }));
  }
  rendered = end;
}

const sentinelObs = new IntersectionObserver((ents) => {
  for (const e of ents) {
    if (e.isIntersecting && rendered < currentList.length) {
      appendBatch();
    }
  }
});
sentinelObs.observe(sentinel);

function openLightbox({ t, img, page, hosts=[], locales=[], pages=[] }) {
  lbContent.innerHTML = `
        < div class="grid grid-cols-1 md:grid-cols-2 gap-4" >
      <div><img src="${escape(img)}" alt="${escape(t)}" class="w-full rounded-lg"/></div>
      <div class="space-y-3">
        <h3 class="text-lg font-semibold">${escape(t || '(untitled)')}</h3>
        <div class="space-x-2">
          <a class="btn btn-sm" href="${escape(page||'#')}" target="_blank" rel="noopener">Product/Page</a>
          <a class="btn btn-sm btn-outline" href="${escape(img)}" target="_blank" rel="noopener">Open image</a>
        </div>
        <div class="text-sm opacity-70 break-all">Image: <a class="link" href="${escape(img)}" target="_blank" rel="noopener">${escape(img)}</a></div>
        <div class="text-sm opacity-70 break-all">Page: ${pages.length ? pages.map(p=>`<a class="link" href="${escape(p)}" target="_blank">link</a>`).join(' · ') : '—'}</div>
        <div class="flex gap-2 flex-wrap">
          ${locales.length? `<div class="badge badge-outline">Locales: ${locales.length}</div>`:''}
          ${hosts.length? `<div class="badge badge-outline">Hosts: ${hosts.length}</div>`:''}
        </div>
      </div>
    </ > `;
  lb.showModal();
}

// stateful update
function update(renderFacetsOnly=false) {
  document.documentElement.style.setProperty('--tile-min', gridRange.value + 'px');

  const viewMode = viewSel.value;     // 'unique' | 'all'
  const dedupMode = dedupSel.value;   // 'originless' | 'url' | 'exact'
  const sortKind  = sortSel.value;
  const needle    = q.value.trim();

  if (viewMode === 'all') {
    statUnique.textContent = '—';
    statDupes.textContent = '—';
    const list = RAW
      .filter(textFilterFn(needle, false))
      .filter(it => passesFacets(it, false))
      .slice()
      .sort(sorter(sortKind));
    currentList = list;
  } else {
    const groups = groupByImage(RAW, dedupMode)
      .filter(textFilterFn(needle, true))
      .filter(g => passesFacets(g, true))
      .slice()
      .sort(sorter(sortKind));
    const uniqueCount = groups.length;
    const dupeGroups = groups.filter(g => g.entries.length > 1).length;
    statUnique.textContent = uniqueCount.toLocaleString();
    statDupes.textContent  = dupeGroups.toLocaleString();
    currentList = groups;
    if (!renderFacetsOnly) renderFacets(groups);
  }

  // render in batches
  clearGrid();
  if (!currentList.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  appendBatch(); // first batch renders immediately; the rest on scroll
}

q.addEventListener('input', () => update());
sortSel.addEventListener('change', () => update());
viewSel.addEventListener('change', () => update());
dedupSel.addEventListener('change', () => update());
resetBtn.addEventListener('click', () => {
  q.value = "";
  viewSel.value = "unique";
  dedupSel.value = "originless";
  sortSel.value  = "loc-desc";
  facetLocales.clear(); facetHosts.clear();
  gridRange.value = 240;
  batchRange.value = 60;
  update();
});
gridRange.addEventListener('input', () => update(true));
batchRange.addEventListener('input', () => {/* affects next batches only */});
themeSel.addEventListener('change', () => {
  document.documentElement.setAttribute('data-theme', themeSel.value);
});
exportBtn.addEventListener('click', () => {
  const data = (viewSel.value === 'unique') ? currentList.map(g => ({
    title: g.title, src: g.reprSrc, locales: g.locales, hosts: g.hosts, pages: g.pages
  })) : currentList.map(e => ({
    title: e.title, src: e.src, pageUrl: e.pageUrl, locale: e._locale, host: e._host
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (viewSel.value === 'unique') ? 'lv-unique.json' : 'lv-raw.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

// initial facet render (on whole set)
renderFacets(groupByImage(RAW, 'originless'));
update();
</script>
</body>
</html>`;
}

// ---------- main ----------
async function main() {
    console.log(`→ Static sitemaps: ${SITEMAP_URLS.length}`);
    const entries = await fetchAllSitemaps(SITEMAP_URLS);
    console.log(`→ Total image entries (raw): ${entries.length}`);
    const html = buildHtml({ entries, sourceList: SITEMAP_URLS });
    await fs.writeFile(OUT_FILE, html, "utf8");
    console.log(`✔ Wrote ${OUT_FILE}`);
}

main().catch(err => {
    console.error("✖ Error:", err?.stack || err);
    process.exit(1);
});
