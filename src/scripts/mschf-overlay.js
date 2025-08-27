// assets/js/mschf-overlay.js
// Effusion Labs — Hypebrüt overlay (always on, non-blocking, theme-tinted).
// Research-first visual ephemera: blueprint callouts, graph clusters, specimen labels,
// stamps/tape/quotes, Murakami-adjacent flowers, spectral rings, topo lines, etc.
// Respects reduced motion; never intercepts pointer events. Idempotent init.
//
// Usage:
// <body data-mschf="auto" data-mschf-intensity="lite" data-mschf-seed-mode="page">
//
// Dev toggles in console: __mschfOff(), __mschfOn()

// ————————————————————————————————————————
// Utilities
// ————————————————————————————————————————
function randomInt() { return crypto.getRandomValues(new Uint32Array(1))[0].toString(); }
function mulberry32(seed) { let t = seed >>> 0; return function () {
  t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
};}
function computeSeed(mode = "page", forced, storage) {
  if (forced) return String(forced);
  if (mode === "session" && storage) {
    const existing = storage.getItem("mschfSeed");
    if (existing) return existing;
    const next = randomInt(); storage.setItem("mschfSeed", next); return next;
  }
  return randomInt();
}
const css  = (el, obj) => { for (const k in obj) el.style[k] = obj[k]; return el; };
const el   = (tag, cls, parent) => { const n = document.createElement(tag); if (cls) n.className = cls; (parent||document.body).appendChild(n); return n; };
const pick = (rand, arr) => arr[Math.floor(rand()*arr.length)];
const chance = (rand, p) => rand() < p;
const px = (v) => `${Math.round(v)}px`;

// ————————————————————————————————————————
// Build/meta helper (optional)
// ————————————————————————————————————————
function readBuildMeta() {
  // Optionally expose build meta on <html> or <body> as data-* if you want
  // E.g., <body data-build-hash="{{ build.hash }}" data-build-branch="{{ build.branch }}">
  const doc = document;
  const src = doc.body || doc.documentElement;
  return {
    hash:   src?.dataset?.buildHash   || "",
    branch: src?.dataset?.buildBranch || "",
    built:  src?.dataset?.builtAt     || new Date().toISOString()
  };
}

// ————————————————————————————————————————
// Main
// ————————————————————————————————————————
function initOverlay() {
  const doc   = document;
  const scope = doc.getElementById("page-shell") || doc.body;
  if (!scope) return;

  // Allow a kill switch
  if (scope.dataset.mschf === "off") return;
  if (localStorage.getItem("mschf:off")) return;

  const intensity = scope.dataset.mschfIntensity || doc.body.dataset.mschfIntensity || "lite";
  const mode      = scope.dataset.mschfSeedMode    || doc.body.dataset.mschfSeedMode    || "page";
  const forced    = new URL(window.location.href).searchParams.get("mschf-seed");
  const seed      = computeSeed(mode, forced, window.sessionStorage);
  const rand      = mulberry32(parseInt(seed, 10) || 0);
  const build     = readBuildMeta();

  // Root
  let root = doc.getElementById("mschf-overlay-root");
  if (!root) root = el("div", "", doc.body), (root.id = "mschf-overlay-root");
  css(root, { pointerEvents:"none", position:"fixed", inset:"0", width:"100vw", height:"100vh", zIndex:"44", color:"hsl(var(--p))" });
  root.setAttribute("aria-hidden","true");
  root.innerHTML = "";

  // Profiles tune density/probabilities per intensity
  const P = profile(intensity);

  // ——— Base scaffold (kept minimal) ———
  if (chance(rand, P.grid))      addGrid(root, rand, intensity);
  if (chance(rand, P.cross))     addCrosshair(root, rand, intensity);
  addCorners(root, intensity);
  addFrame(root, intensity);
  if (chance(rand, P.scan))      addScanline(root);

  // ——— Culture-coded ephemera ———
  if (chance(rand, P.tape))      addTapeLabels(root, rand, intensity);
  if (chance(rand, P.stamp))     addStamp(root, rand);
  if (chance(rand, P.quotes))    addQuotes(root, rand);
  if (chance(rand, P.barcode))   addPlate(root, rand, seed, build);
  if (chance(rand, P.specimen))  addSpecimenLabel(root, rand, build);

  // ——— Lab/blueprint/OSINT aesthetics ———
  if (chance(rand, P.callout))   addBlueprintCallout(root, rand);
  if (chance(rand, P.graph))     addGraphCluster(root, rand, intensity);
  if (chance(rand, P.rings))     addSpectralRings(root, rand, intensity);
  if (chance(rand, P.topo))      addTopo(root, rand);
  if (chance(rand, P.halftone))  addHalftone(root, rand);
  if (chance(rand, P.crt))       addCRTMask(root, rand);
  if (chance(rand, P.perf))      addPerforation(root, rand);
  if (chance(rand, P.starfield)) addStarfield(root, rand);

  // ——— Framing and stickers ———
  if (chance(rand, P.brackets))  addBrackets(root, rand);
  if (chance(rand, P.glitch))    addGlitchSlices(root, rand, intensity);
  if (chance(rand, P.rulers))    addRulers(root);
  if (chance(rand, P.watermark)) addWatermark(root);
  if (chance(rand, P.flowers))   addFlowers(root, rand, intensity);
  if (chance(rand, P.holo))      addHolo(root, intensity);
  if (chance(rand, P.reg))       addRegMarks(root, intensity);
  if (chance(rand, P.dims))      addDims(root, rand);
  if (chance(rand, P.stickers))  addStickers(root, rand);

  // Dev toggles
  window.__mschfOff = () => { localStorage.setItem("mschf:off","1"); root.remove(); };
  window.__mschfOn  = () => { localStorage.removeItem("mschf:off"); initOverlay(); };
}

function profile(intensity) {
  // probabilities per category; tuned for research/aesthetic site
  const base = {
    grid:.70, cross:.55, corners:1,  frame:1,  scan:.18,
    tape:.55, stamp:.45, quotes:.65, barcode:.35,
    callout:.55, graph:.60, rings:.45, topo:.40, halftone:.35, crt:.20, perf:.30, specimen:.40, starfield:.30,
    brackets:.45, glitch:.35, rulers:.35, watermark:.25, flowers:.45, holo:.35, reg:.55, dims:.40, stickers:.45
  };
  const bold = {
    grid:.90, cross:.70, corners:1,  frame:1,  scan:.40,
    tape:.75, stamp:.65, quotes:.80, barcode:.45,
    callout:.70, graph:.80, rings:.65, topo:.60, halftone:.55, crt:.35, perf:.45, specimen:.55, starfield:.45,
    brackets:.65, glitch:.55, rulers:.50, watermark:.40, flowers:.60, holo:.55, reg:.70, dims:.55, stickers:.60
  };
  const loud = {
    grid:1.00, cross:.85, corners:1, frame:1,  scan:.60,
    tape:.85, stamp:.75, quotes:.90, barcode:.55,
    callout:.85, graph:.90, rings:.80, topo:.75, halftone:.70, crt:.55, perf:.55, specimen:.65, starfield:.60,
    brackets:.80, glitch:.70, rulers:.60, watermark:.50, flowers:.75, holo:.70, reg:.85, dims:.65, stickers:.75
  };
  const calm = {
    grid:.35, cross:.30, corners:1,  frame:1,  scan:.06,
    tape:.22, stamp:.18, quotes:.28, barcode:.18,
    callout:.25, graph:.30, rings:.20, topo:.18, halftone:.15, crt:.10, perf:.12, specimen:.20, starfield:.15,
    brackets:.22, glitch:.12, rulers:.20, watermark:.12, flowers:.18, holo:.12, reg:.30, dims:.18, stickers:.15
  };
  if (intensity === "bold") return bold;
  if (intensity === "loud") return loud;
  if (intensity === "calm") return calm;
  return base; // "lite"
}

// ————————————————————————————————————————
// Base elements
// ————————————————————————————————————————
function addGrid(root, rand, intensity) {
  const g = el("div", "mschf-grid", root);
  g.dataset.variant = rand() < 0.5 ? "dots" : "lines";
  g.style.opacity = (intensity === "loud" ? "0.12" : "0.08");
}
function addCrosshair(root, rand, intensity) {
  const cross = el("div", "mschf-crosshair", root);
  if (rand() < 0.5) {
    cross.classList.add("is-offset");
    cross.style.setProperty("--mschf-x", `${50 + Math.round((rand()-0.5)*40)}vw`);
    cross.style.setProperty("--mschf-y", `${50 + Math.round((rand()-0.5)*24)}vh`);
  }
  el("div","mschf-crosshair-ring",cross);
  el("div","mschf-crosshair-v",cross);
  el("div","mschf-crosshair-h",cross);
}
function addCorners(root, intensity) {
  ["tl","tr","bl","br"].forEach(pos => {
    const c = el("div", `mschf-corner mschf-corner-${pos}`, root);
    c.style.opacity = (intensity === "calm" ? "0.08" : "0.14");
  });
}
function addFrame(root, intensity) {
  const f = el("div", "mschf-frame", root);
  f.style.opacity = (intensity === "loud" ? "0.22" : "0.14");
}
function addScanline(root) {
  const s = el("div", "mschf-scanline", root);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) s.classList.add("static");
}

// ————————————————————————————————————————
// Culture-coded ephemera
// ————————————————————————————————————————
function addTapeLabels(root, rand, intensity) {
  // Expanded tape vocabulary (quotes = Off-White style; tones map to A/B/C pastel & readable)
  const tapes = [
    { text:'"KEEP OFF"', tone:"c" }, { text:'"FOR DISPLAY ONLY"', tone:"a" },
    { text:'"PROTOTYPE"', tone:"b" }, { text:'"ARCHIVE"', tone:"c" },
    { text:'"FIELD NOTES"', tone:"a" }, { text:'"RED TEAM"', tone:"b" },
    { text:'"PAYLOAD"', tone:"c" }, { text:'"SIMULACRUM"', tone:"a" },

    { text:'"SPECIMEN"', tone:"b" }, { text:'"ARTIFACT"', tone:"a" },
    { text:'"EVIDENCE"', tone:"c" }, { text:'"PROVENANCE"', tone:"a" },
    { text:'"BLUEPRINT"', tone:"b" }, { text:'"DRAFT"', tone:"c" },

    { text:'"ALPHA"', tone:"a" }, { text:'"BETA"', tone:"b" }, { text:'"RC1"', tone:"c" },
    { text:'"NIGHTLY"', tone:"a" }, { text:'"CANARY"', tone:"b" }, { text:'"WIP"', tone:"c" },

    { text:'"REDACTED"', tone:"a" }, { text:'"DECLASSIFIED"', tone:"b" }, { text:'"NONCANON"', tone:"c" },
    { text:'"UNSANCTIONED"', tone:"a" }, { text:'"UNVERIFIED"', tone:"b" }, { text:'"NULL RESULT"', tone:"c" },

    { text:'"KEEP OUT"', tone:"a" }, { text:'"OFF LIMITS"', tone:"b" }, { text:'"NO ENTRY"', tone:"c" },
    { text:'"DO NOT TOUCH"', tone:"a" }, { text:'"HANDLE WITH CARE"', tone:"b" },

    { text:'"FOR RESEARCH ONLY"', tone:"a" }, { text:'"FOR INTERNAL USE"', tone:"b" },
    { text:'"SANDBOX"', tone:"c" }, { text:'"SIMULATION"', tone:"a" },

    { text:'"GRAPH"', tone:"a" }, { text:'"NODE"', tone:"b" }, { text:'"EDGE"', tone:"c" },
    { text:'"EMBEDDING"', tone:"a" }, { text:'"RAG"', tone:"b" }, { text:'"EVAL"', tone:"c" },

    { text:'"READ ONLY"', tone:"a" }, { text:'"NO INDEX"', tone:"b" }, { text:'"NO EXPORT"', tone:"c" }
  ];

  // How many tapes to drop
  const count = 1 + Math.floor(rand() * (intensity === "loud" ? 4 : 2));

  for (let i = 0; i < count; i++) {
    const t = pick(rand, tapes);
    const tape = el("div", `mschf-tape tone-${t.tone}`, root);

    // Optional: hazard stripe override (some % of the time)
    if (rand() < (intensity === "loud" ? 0.45 : 0.25)) {
      tape.style.background = "repeating-linear-gradient(45deg, #ffd500 0 8px, #000 8px 16px)";
      tape.style.color = "#0b0b0e";
      tape.style.borderStyle = "solid";
    } else if (rand() < 0.25) {
      // Clear acetate-esque tape variant
      tape.style.background = "linear-gradient(to bottom, rgba(255,255,255,.22), rgba(255,255,255,.08))";
      tape.style.backdropFilter = "blur(2px)";
      tape.style.borderStyle = "dotted";
    }

    // Serial/rig hint
    const rig = (Math.random().toString(16).slice(2, 6)).toUpperCase();
    tape.textContent = `${t.text} • RIG-${rig}`;

    // Transform & size
    const rot = (rand() - 0.5) * (intensity === "loud" ? 14 : 6);
    const skew = (rand() - 0.5) * 4;
    const w = 32 + Math.floor(rand() * 52); // vw
    const top = 6 + Math.floor(rand() * 74);
    const left = -12 + Math.floor(rand() * 70);

    css(tape, {
      top: `${top}%`,
      left: `${left}%`,
      width: `${w}vw`,
      transform: `rotate(${rot}deg) skewX(${skew}deg)`,
      opacity: (intensity === "calm" ? ".20" : ".32")
    });
  }
}

function addStamp(root, rand) {
  const stamps = [
    "LAB DROP","EXPERIMENTAL","UNSTABLE","FIELD TEST","FOR INTERNAL USE",
    "NULL RESULT","RECALIBRATE","KEEP OFF","DECLASSIFIED","NONCANON",
    "UNSANCTIONED","FOR RESEARCH ONLY","UNVERIFIED","ARCHIVE ONLY","READ ONLY",
    "CHECKSUM FAIL","RETRY","REINDEX","RESAMPLE","REHYDRATE"
  ];

  const s = el("div", "mschf-stamp", root);
  s.textContent = pick(rand, stamps);

  // Variant styling
  const variants = [
    () => { s.style.borderWidth = "2px"; s.style.letterSpacing = ".12em"; },
    () => { s.style.borderWidth = "3px"; s.style.letterSpacing = ".18em"; s.style.transform += " scale(1.05)"; },
    () => { s.style.borderRadius = "999px"; s.style.padding = "6px 12px"; },
    () => { s.style.mixBlendMode = "overlay"; s.style.opacity = ".9"; },
    () => { s.style.filter = "contrast(1.3) saturate(1.1)"; }
  ];
  pick(rand, variants)();

  // Position: random corner band
  const corner = pick(rand, ["top-right","top-left","bottom-right","bottom-left"]);
  const rot = (rand() - 0.5) * 12;
  const insetX = 6 + Math.floor(rand() * 14);
  const insetY = 8 + Math.floor(rand() * 16);

  const style = { transform: `rotate(${rot}deg)` };
  if (corner === "top-right")  { style.right = `${insetX}%`; style.top = `${insetY}%`; }
  if (corner === "top-left")   { style.left  = `${insetX}%`; style.top = `${insetY}%`; }
  if (corner === "bottom-right"){ style.right = `${insetX}%`; style.bottom = `${insetY}%`; }
  if (corner === "bottom-left"){ style.left  = `${insetX}%`; style.bottom = `${insetY}%`; }
  css(s, style);
}

function addQuotes(root, rand) {
  // Off-White style quotes, kept positive/neutral
  const phrases = [
    '"OBJECT"','"INTERFACE"','"ARTIFACT"','"SYSTEM"','"SPECIMEN"','"EVIDENCE"',
    '"PROTOTYPE"','"KNOWLEDGE"','"GRAPH"','"SPARK"','"VECTOR"','"EMBEDDING"',
    '"SANDBOX"','"SIMULATION"','"RAG"','"EVAL"','"CATALOG"','"ATLAS"','"WORKBOARD"'
  ];

  const q = el("div", "mschf-quotes", root);
  const idtail = (Math.random().toString(36).slice(2,5)).toUpperCase();
  q.textContent = `${pick(rand, phrases)} • ${idtail}`;

  const side = rand() < 0.5 ? "right" : "left";
  const vertical = rand() < 0.3 ? "top" : "bottom";
  const offX = 12 + Math.floor(rand() * 24);
  const offY = 10 + Math.floor(rand() * 18);

  const style = {};
  if (side === "right") style.right = `${offX}px`; else style.left = `${offX}px`;
  if (vertical === "top") style.top = `${offY}px`; else style.bottom = `${offY}px`;

  // Minor rotation & glow
  style.transform = `rotate(${(rand()-0.5)*2.2}deg)`;
  style.boxShadow = "0 0 0 1px rgba(255,255,255,.04) inset, 0 8px 18px rgba(0,0,0,.35)";
  css(q, style);
}

function addSpecimenLabel(root, rand, build) {
  const lab = el("div", "mschf-specimen", root);
  const id  = (Math.random().toString(36).slice(2,7)).toUpperCase();
  const hash = build?.hash ? build.hash.slice(0,7) : "";
  const date = (build?.built || new Date().toISOString()).slice(0,10);
  const branch = build?.branch || "main";
  const rev = ["A","B","C","D"][Math.floor(rand()*4)];

  // Optional path hint (non-sensitive)
  const pathHint = (location && location.pathname) ? location.pathname : "/";

  lab.innerHTML = `
    <strong>SPECIMEN</strong>
    <span>ID ${id}</span>
    ${hash ? `<span>BUILD ${hash}</span>` : ""}
    <span>${date}</span>
    <span>BR ${branch}</span>
    <span>REV ${rev}</span>
    <span>PATH ${pathHint}</span>
  `;

  // Dock near a corner with slight variance
  const side = rand() < 0.5 ? "right" : "left";
  const offX = 18 + Math.floor(rand()*24);
  const offY = 16 + Math.floor(rand()*20);
  const style = {};
  if (side === "right") style.right = `${offX}px`; else style.left = `${offX}px`;
  style.top = `${offY}px`;
  css(lab, style);
}

function addPlate(root, rand, seed, build) {
  const plate = el("div","mschf-plate", root);
  el("div","mschf-barcode", plate);
  const code = el("div","mschf-code", plate);
  const tail = seed.slice(-6);
  const stamp = (build?.built || new Date().toISOString()).slice(0,10);
  code.textContent = `SEED:${tail} • BR:${(build.branch||"main")} • ${stamp}`;
  css(plate,{ left:"18px", top:"18px" });
}

// ————————————————————————————————————————
// Lab/blueprint/OSINT
// ————————————————————————————————————————
function addBlueprintCallout(root, rand) {
  const c = el("div","mschf-callout", root);
  const x = 8 + rand()*84, y = 18 + rand()*64;
  const len = 8 + rand()*16; // length of leader
  c.style.setProperty("--x", `${x}vw`);
  c.style.setProperty("--y", `${y}vh`);
  c.style.setProperty("--len", `${len}vh`);
  const labels = ["NODE", "EDGE", "BAYES p", "Z", "Δt", "ID"];
  const val    = Math.random().toString(36).slice(2,5).toUpperCase();
  c.textContent = `${pick(rand, labels)} ${val} • ${Math.random().toFixed(2)}`;
}

function addGraphCluster(root, rand, intensity) {
  const cluster = el("div","mschf-graph", root);
  const n = 5 + Math.floor(rand()* (intensity === "loud" ? 10 : 6));
  for (let i=0;i<n;i++) {
    const node = el("span","mschf-graph-node", cluster);
    node.style.setProperty("--x", `${rand()*100}vw`);
    node.style.setProperty("--y", `${rand()*100}vh`);
  }
  // A few edges
  const m = 3 + Math.floor(rand()*4);
  for (let i=0;i<m;i++) {
    const e = el("i","mschf-graph-edge", cluster);
    e.style.setProperty("--x1", `${rand()*100}vw`);
    e.style.setProperty("--y1", `${rand()*100}vh`);
    e.style.setProperty("--x2", `${rand()*100}vw`);
    e.style.setProperty("--y2", `${rand()*100}vh`);
  }
}

function addSpectralRings(root, rand, intensity) {
  const r = el("div","mschf-rings", root);
  const s = 120 + Math.floor(rand()*220);
  css(r, { left:`${10 + rand()*80}%`, top:`${10 + rand()*70}%`, width:px(s), height:px(s) });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) r.classList.add("static");
}

function addTopo(root, rand) {
  const t = el("div","mschf-topo", root);
  t.style.setProperty("--rot", `${Math.floor((rand()-0.5)*30)}deg`);
  t.style.opacity = ".10";
}
function addHalftone(root, rand) {
  const h = el("div","mschf-halftone", root);
  const corner = pick(rand, ["tl","tr","bl","br"]);
  h.classList.add(corner);
  h.style.opacity = ".10";
}
function addCRTMask(root, rand) {
  const c = el("div","mschf-crt", root);
  c.style.opacity = ".06";
}
function addPerforation(root, rand) {
  const p = el("div","mschf-perf", root);
  p.dataset.side = pick(rand, ["top","bottom","left","right"]);
}
function addStarfield(root, rand) {
  const star = el("div","mschf-stars", root);
  star.style.setProperty("--density", `${0.15 + rand()*0.35}`);
}

function addBrackets(root, rand) {
  const b = el("div","mschf-brackets", root);
  b.classList.add(pick(rand, ["tight","wide"]));
}
function addGlitchSlices(root, rand, intensity) {
  const n = 2 + Math.floor(rand()*(intensity === "loud" ? 4 : 2));
  for (let i=0;i<n;i++) {
    const g = el("div","mschf-glitch", root);
    css(g, { top: `${Math.floor(rand()*100)}%`, left: "0", right: "0" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) g.classList.add("static");
  }
}
function addRulers(root) {
  el("div","mschf-ruler mschf-ruler-top", root);
  el("div","mschf-ruler mschf-ruler-left", root);
}
function addWatermark(root) {
  const wm = el("div","mschf-watermark", root);
  wm.textContent = "EFFUSION LABS • PROTOTYPE • ";
}
function addFlowers(root, rand, intensity) {
  const n = 1 + Math.floor(rand() * (intensity === "loud" ? 4 : 2));
  for (let i=0;i<n;i++) {
    const fl = el("div","mschf-flower", root);
    const s = 38 + Math.floor(rand()*32);
    const x = 10 + Math.floor(rand()*80);
    const y = 10 + Math.floor(rand()*70);
    css(fl,{ width:px(s), height:px(s), left:`${x}%`, top:`${y}%`, transform:`rotate(${Math.floor((rand()-0.5)*180)}deg)` });
  }
}
function addHolo(root, intensity) {
  const h = el("div","mschf-holo", root);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) h.classList.add("static");
}
function addRegMarks(root, intensity) {
  ["tl","tr","bl","br"].forEach(pos => el("div",`mschf-reg ${pos}`, root));
}
function addDims(root, rand) {
  const d = el("div","mschf-dims", root);
  const x1 = 10 + Math.floor(rand()*30);
  const x2 = x1 + 20 + Math.floor(rand()*35);
  const y  = 20 + Math.floor(rand()*60);
  d.style.setProperty("--x1", `${x1}vw`);
  d.style.setProperty("--x2", `${x2}vw`);
  d.style.setProperty("--y",  `${y}vh`);
  d.textContent = `${Math.abs(x2-x1)}vw`;
}
function addStickers(root, rand) {
  const cluster = el("div", "mschf-stickers", root);
  const badges = [
    "ALPHA","BETA","RC1","SIGNED","VOID","UNLOCKED","PASS","LAB","SIM",
    "ARCHIVE","SANDBOX","RAG","EVAL","GRAPH","SPARK","VECTOR","EMBED","SPECIMEN","PROTO"
  ];

  // Place cluster in a random corner
  const corner = pick(rand, ["br","bl","tr","tl"]);
  const off = 18 + Math.floor(rand()*18);
  const style = {};
  if (corner.includes("b")) style.bottom = `${off}px`; else style.top = `${off}px`;
  if (corner.includes("r")) style.right  = `${off}px`; else style.left = `${off}px`;
  css(cluster, style);

  // 2–5 stickers with per-sticker transforms & size variance
  const n = 2 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const b = el("span", "mschf-badge", cluster);
    b.textContent = pick(rand, badges);

    // Size & weight variance (inline so we don't need extra CSS)
    const sizes = [
      () => { b.style.fontSize = "10px"; b.style.padding = "5px 7px"; },
      () => { b.style.fontSize = "11px"; b.style.padding = "6px 8px"; },
      () => { b.style.fontSize = "12px"; b.style.padding = "7px 9px"; }
    ];
    pick(rand, sizes)();

    // Transform offsets
    b.style.setProperty("--rx", `${Math.floor((rand()-0.5)*18)}deg`);
    b.style.setProperty("--offx", `${Math.floor((rand()-0.5)*18)}px`);
    b.style.setProperty("--offy", `${Math.floor((rand()-0.5)*12)}px`);

    // Occasional outline accent
    if (rand() < 0.25) {
      b.style.boxShadow = "0 0 0 1px color-mix(in oklab, currentColor 35%, transparent), 0 10px 18px rgba(0,0,0,.35)";
    }
  }
}

document.addEventListener("DOMContentLoaded", initOverlay);
