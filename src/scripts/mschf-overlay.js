// assets/js/mschf-overlay.js
// Effusion Labs — Hypebrüt Overlay v2 (Autonomous / Emergent / 2025-tier)
// Theme-tinted, non-blocking, SPA-safe, mobile-sane, reduced-motion/data aware.
// External deps: PixiJS v8 (loaded dynamically if not provided via import map/build).
// Usage: keep <div id="mschf-overlay-root" class="text-primary" aria-hidden="true"></div> in layout.
// Console: __mschfOn(), __mschfOff(), __mschfPulse(), __mschfMood(m), __mschfDensity(x)

(() => {
  if (window.__mschfBooted) return;
  window.__mschfBooted = true;

  // ————————————————————————————————————————
  // Guards / kill switch
  // ————————————————————————————————————————
  const scope = document.body || document.documentElement;
  if (!scope) return;
  if (scope.dataset.mschf === 'off') return;
  if (localStorage.getItem('mschf:off') === '1') return;

  // ————————————————————————————————————————
  // Utilities
  // ————————————————————————————————————————
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const now   = () => performance.now();
  const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)]; // unseeded by design

  const css = (el, obj) => { for (const k in obj) el.style[k] = obj[k]; return el; };
  const el  = (tag, cls, parent) => { const n = document.createElement(tag); if (cls) n.className = cls; (parent||document.body).appendChild(n); return n; };

  // External dep loader (PixiJS v8). You may swap to your own import map.
  async function loadPixi() {
    if (globalThis.PIXI && globalThis.PIXI.Application) return globalThis.PIXI;
    const sources = [
      'https://cdn.jsdelivr.net/npm/pixi.js@8.2.1/dist/pixi.min.mjs',
      'https://esm.sh/pixi.js@8',
      'https://cdn.skypack.dev/pixi.js@8'
    ];
    for (const src of sources) {
      try { const mod = await import(/* @vite-ignore */ src); return mod.default || mod; } catch {}
    }
    return null;
  }

  // ————————————————————————————————————————
  // Global State
  // ————————————————————————————————————————
  const State = {
    root: null, domLayer: null, gpu: null, app: null,
    style: scope.dataset.mschfStyle || 'auto',
    densityToken: scope.dataset.mschfDensity || 'lite',
    density: 0.45,
    mood: 'calm', // calm → lite → bold → loud → storm → studio
    tempo: 1.0,
    reduceMotion: matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    reduceData: !!(navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType||''))),
    visible: !document.hidden,
    nodeBudget: 160, nodeCount: 0,
    actors: new Set(),
    families: { scaffold: new Set(), ephemera: new Set(), lab: new Set(), frame: new Set() },
    beats: { last: now(), dur: 640 },
    bars:  { last: now(), dur: 3200 },
    safeZones: [],
    occupancy: [],
    gridCols: 10,
    gridRows: 6,
    paused: false,
    fps: { samples: [], bad: false },
    tiers: { xs: false, sm: false, md: false, lg: false },
  };

  // Density from token
  const densityMap = { calm: 0.25, lite: 0.45, bold: 0.7, loud: 0.9 };
  if (densityMap[State.densityToken]) State.density = densityMap[State.densityToken];

  // Style
  if (State.style === 'auto') State.style = pick(['collage','structural','playful']);

  // ————————————————————————————————————————
  // Root mount
  // ————————————————————————————————————————
  function mountRoot() {
    let root = document.getElementById('mschf-overlay-root');
    if (!root) { root = el('div','',document.body); root.id = 'mschf-overlay-root'; }
    css(root, {
      pointerEvents:'none', position:'fixed', inset:'0', width:'100vw', height:'100vh',
      zIndex: getComputedStyle(document.documentElement).getPropertyValue('--mschf-z')?.trim() || '44',
      color:'currentColor', contain:'layout style paint', contentVisibility:'auto'
    });
    root.setAttribute('aria-hidden','true');
    root.innerHTML = '';
    const domLayer = el('div','mschf-layer',root);
    css(domLayer,{ position:'absolute', inset:0 });
    State.root = root; State.domLayer = domLayer;
  }

  // ————————————————————————————————————————
  // Mobile tiers
  // ————————————————————————————————————————
  function computeTiers() {
    const w = innerWidth;
    State.tiers.xs = w < 480;
    State.tiers.sm = w >= 480 && w < 768;
    State.tiers.md = w >= 768 && w < 1024;
    State.tiers.lg = w >= 1024;
  }

  // ————————————————————————————————————————
  // Safe zones & placement
  // ————————————————————————————————————————
  function computeSafeZones() {
    const selFallback = '.prose, header, nav, .map-cta, [data-safe], [data-mschf-safe], [data-occlude="avoid"]';
    const sel = scope.getAttribute('data-mschf-safe') || selFallback;
    const pad = 16;
    const rects = [...document.querySelectorAll(sel)]
      .map(n => n.getBoundingClientRect())
      .filter(r => r.width * r.height > 0)
      .map(r => ({ x: clamp(r.left - pad, 0, innerWidth), y: clamp(r.top - pad, 0, innerHeight), w: clamp(r.width + pad*2, 0, innerWidth), h: clamp(r.height + pad*2, 0, innerHeight) }));
    State.safeZones = rects;
  }
  function rectOverlap(a,b) {
    const x = Math.max(0, Math.min(a.x+a.w, b.x+b.w) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.y+a.h, b.y+b.h) - Math.max(a.y, b.y));
    return x*y;
  }
  function collidesSafe(r) {
    const area = Math.max(1, r.w * r.h);
    for (const z of State.safeZones) if (rectOverlap(r,z)/area > 0.08) return true;
    return false;
  }
  function resetOccupancy() { State.occupancy = new Array(State.gridCols*State.gridRows).fill(0); }
  function isCellFree(c,r){ return !State.occupancy[r*State.gridCols + c]; }
  function claimCell(c,r){ State.occupancy[r*State.gridCols + c] = 1; }

  // Gutter-first placement (avoid text columns)
  function findSpot(w,h) {
    // prefer gutters: left 0–10vw or right 90–100vw; else random grid
    const tryGutter = () => {
      const left = Math.random() < 0.5;
      const x = left ? Math.round(Math.random()*Math.min(innerWidth*0.1, 120)) : Math.round(innerWidth - w - Math.random()*Math.min(innerWidth*0.1, 120));
      const y = Math.round(Math.random()*(innerHeight - h));
      const rect = { x, y, w, h }; if (!collidesSafe(rect)) return rect;
      return null;
    };
    for (let i=0;i<16;i++){ const r = tryGutter(); if (r) return r; }

    const maxTry = 28;
    for (let i=0;i<maxTry;i++) {
      const cx = Math.floor(Math.random()*State.gridCols);
      const cy = Math.floor(Math.random()*State.gridRows);
      if (!isCellFree(cx,cy)) continue;
      const rx = Math.round((cx/State.gridCols)*innerWidth);
      const ry = Math.round((cy/State.gridRows)*innerHeight);
      const rect = { x: clamp(rx - w*0.1, 0, innerWidth - w), y: clamp(ry - h*0.1, 0, innerHeight - h), w, h };
      if (!collidesSafe(rect)) { claimCell(cx,cy); return rect; }
    }
    return { x: Math.round(Math.random()*(innerWidth - w)), y: Math.round(Math.random()*(innerHeight - h)), w, h };
  }

  // ————————————————————————————————————————
  // Mood machine
  // ————————————————————————————————————————
  const moods = ['calm','lite','bold','loud','storm','studio'];
  function nextMood(cur){
    const idx = moods.indexOf(cur);
    const roll = Math.random();
    const step = roll < 0.6 ? 1 : roll < 0.85 ? 2 : 3;
    return moods[(idx + step) % moods.length];
  }
  function applyMood(mood){
    State.mood = mood;
    const t = { calm:.9, lite:1.0, bold:1.15, loud:1.25, storm:1.35, studio:.95 }[mood] || 1.0;
    State.tempo = t;
    State.bars.dur  = lerp(2600, 4000, 1/(State.tempo+.01));
    State.beats.dur = lerp(520, 760, 1/(State.tempo+.01));
    const base = { calm:.25, lite:.45, bold:.65, loud:.8, storm:.95, studio:.4 }[mood] || .5;
    State.density = clamp(lerp(State.density, base, .6), .2, .96);

    // Page-type caps (reading pages calmer)
    const isArticle = !!document.querySelector('.prose,[data-kind="spark"],[data-kind="concept"],[data-kind="project"]');
    if (isArticle) State.density = Math.min(State.density, .5);
    if (State.tiers.xs || State.tiers.sm) State.density = Math.min(State.density, .5);

    if (State.root) State.root.dataset.mood = mood;
  }

  // ————————————————————————————————————————
  // GPU (PixiJS) layer
  // ————————————————————————————————————————
  const GPU = {
    app: null, stage: null, rings: null, topo: null, crt: null, starfield: null, glow: null,
    async init() {
      if (State.reduceData) return null;
      const PIXI = await loadPixi();
      if (!PIXI) return null;

      const app = new PIXI.Application();
      await app.init({
        width: innerWidth, height: innerHeight, antialias: true, autoDensity: true, backgroundAlpha: 0,
        powerPreference: 'high-performance', useBackBuffer: false, resolution: devicePixelRatio > 2 ? 2 : devicePixelRatio
      });
      State.root.appendChild(app.canvas);
      css(app.canvas, { position:'absolute', inset:0 });

      const stage = app.stage;
      this.app = app; this.stage = stage;

      // Post effects (glow/bloom)
      try {
        const { GlowFilter } = await import('https://cdn.jsdelivr.net/npm/@pixi/filter-glow@5.2.1/dist/filter-glow.min.mjs').catch(()=>({}));
        if (GlowFilter && !State.reduceMotion) {
          this.glow = new GlowFilter({ distance: 12, outerStrength: 0.25, innerStrength: 0.0, color: 0xffffff, quality: .25 });
          stage.filters = [this.glow];
        }
      } catch {}

      // Rings: SDF concentric rings with subtle pulse
      this.rings = this.makeRings(PIXI);
      stage.addChild(this.rings.container);

      // Topo: procedural stripes (cheap, sine-based)
      this.topo = this.makeTopo(PIXI);
      stage.addChild(this.topo.container);

      // Starfield
      this.starfield = this.makeStars(PIXI);
      stage.addChild(this.starfield.container);

      // CRT mask lines (very subtle)
      this.crt = this.makeCRT(PIXI);
      stage.addChild(this.crt.container);

      // Resize
      addEventListener('resize', () => {
        app.renderer.resize(innerWidth, innerHeight);
        this.rings.resize(); this.topo.resize(); this.starfield.resize(); this.crt.resize();
      });

      return app;
    },

    makeRings(PIXI) {
      const container = new PIXI.Container();
      const g = new PIXI.Graphics();
      container.addChild(g);

      function draw(cx, cy, baseR, color) {
        g.clear();
        g.alpha = .15;
        g.blendMode = PIXI.BLEND_MODES.ADD;
        g.lineStyle(1, color, 1);
        for (let i=0;i<3;i++) g.drawCircle(cx, cy, baseR + i*baseR*.33);
        g.endFill();
      }

      let cx = innerWidth*0.5, cy = innerHeight*0.3, base = Math.min(innerWidth, innerHeight)*0.06;
      let tint = 0xffffff;

      function resize(){ cx = innerWidth*0.5; cy = Math.max(64, innerHeight*0.28); base = Math.min(innerWidth, innerHeight)*0.055; }
      function step(t){
        if (State.reduceMotion) { draw(cx, cy, base, tint); return; }
        const beat = 1 + Math.sin(t/1200) * .06 * State.tempo;
        draw(cx, cy, base*beat, tint);
      }
      resize();
      return { container, step, resize };
    },

    makeTopo(PIXI) {
      const container = new PIXI.Container(); container.alpha = .12;
      const g = new PIXI.Graphics(); container.addChild(g);

      function draw(){
        g.clear(); g.blendMode = PIXI.BLEND_MODES.SCREEN;
        const w = innerWidth, h = innerHeight;
        const lines = 18;
        for (let i=0;i<lines;i++){
          const y = (h/lines)*i + Math.sin(i*1.23)*6;
          g.lineStyle(1, 0xffffff, .35);
          g.moveTo(0, y);
          for (let x=0;x<=w;x+=24){
            const yy = y + Math.sin((x*0.01)+(i*0.6))*6 + Math.sin((x*0.031)-(i))*3;
            g.lineTo(x, yy);
          }
        }
      }
      function resize(){ draw(); }
      function step(t){
        if (State.reduceMotion) return;
        if (Math.random() < 0.02 * State.tempo) draw();
      }
      draw();
      return { container, step, resize };
    },

    makeStars(PIXI) {
      const container = new PIXI.Container(); container.alpha = .12;
      container.blendMode = PIXI.BLEND_MODES.SCREEN;
      const starTex = PIXI.Texture.WHITE;
      const sprites = [];

      function populate(){
        container.removeChildren(); sprites.length = 0;
        const n = Math.floor(60 + (State.density*80) * (State.tiers.lg ? 1 : .6));
        for (let i=0;i<n;i++){
          const s = new PIXI.Sprite(starTex);
          const size = Math.random()*2 + .5;
          s.tint = 0xffffff; s.alpha = Math.random()*.75 + .25;
          s.width = size; s.height = size;
          s.x = Math.random()*innerWidth; s.y = Math.random()*innerHeight;
          container.addChild(s); sprites.push(s);
        }
      }
      function resize(){ populate(); }
      function step(){
        if (State.reduceMotion || State.tiers.xs) return;
        if (Math.random() < 0.2) return;
        const k = (State.tempo * 0.12) * (State.tiers.lg ? 1 : .6);
        for (let i=0;i<sprites.length;i+=7){
          const s = sprites[i];
          s.y += (Math.random() - .5) * k;
          s.x += (Math.random() - .5) * k;
          if (s.x<0) s.x=innerWidth; if (s.x>innerWidth) s.x=0;
          if (s.y<0) s.y=innerHeight; if (s.y>innerHeight) s.y=0;
        }
      }
      populate();
      return { container, step, resize };
    },

    makeCRT(PIXI) {
      const container = new PIXI.Container();
      const g = new PIXI.Graphics(); container.addChild(g);
      function draw(){
        g.clear(); container.alpha = .06;
        const w = innerWidth, h = innerHeight;
        g.beginFill(0xff0000, .25);
        for (let y=0; y<h; y+=6) g.drawRect(0, y, w, 1);
        g.beginFill(0x00ff00, .25);
        for (let y=2; y<h; y+=6) g.drawRect(0, y, w, 1);
        g.beginFill(0x0000ff, .25);
        for (let y=4; y<h; y+=6) g.drawRect(0, y, w, 1);
        g.endFill();
      }
      function resize(){ draw(); }
      function step() {}
      draw();
      return { container, step, resize };
    },

    step(t){
      if (!this.stage) return;
      if (this.rings) this.rings.step(t);
      if (this.topo)  this.topo.step(t);
      if (this.starfield) this.starfield.step(t);
      if (this.crt) this.crt.step(t);
    }
  };

  // ————————————————————————————————————————
  // Actor Framework (DOM ornaments)
  // ————————————————————————————————————————
  function mount(actor, family){
    if (!actor) return;
    // mobile + article constraints
    const isArticle = !!document.querySelector('.prose,[data-kind="spark"],[data-kind="concept"],[data-kind="project"]');
    if ((State.tiers.xs || State.tiers.sm) && family !== 'scaffold') {
      // On small screens only allow minimal ornaments below
      const allow = ['frame','corners','rulers'];
      if (!allow.includes(actor.kind || '')) return;
    }
    if (isArticle && family !== 'scaffold') {
      // Articles: allow only quiet elements
      const quiet = ['tape','quotes','specimen','plate','dims','reg','brackets'];
      if (!quiet.includes(actor.kind || '') && State.density > .5) return;
    }

    State.families[family].add(actor);
    State.actors.add(actor);
    State.nodeCount += actor.cost || 1;
    try { actor.mount(State.domLayer); } catch {}
  }
  function retire(actor){
    if (!actor) return;
    try { actor.retire && actor.retire(); } catch {}
    try { actor.node && actor.node.remove(); } catch {}
    State.actors.delete(actor);
    for (const k in State.families) State.families[k].delete(actor);
    State.nodeCount = Math.max(0, State.nodeCount - (actor.cost || 1));
  }

  const A = {}; // actor factory bag

  // Scaffold
  A.grid = () => {
    let node; return {
      kind:'grid', cost:1,
      mount(p){ node = el('div','mschf-grid',p); node.dataset.variant = Math.random()<.5?'dots':'lines'; },
      update(){ if (Math.random()< .002 * State.tempo) node.dataset.variant = node.dataset.variant==='dots'?'lines':'dots'; },
      node
    };
  };
  A.frame = () => {
    let node; return {
      kind:'frame', cost:1,
      mount(p){ node = el('div','mschf-frame',p); },
      update(t){ node.style.setProperty('--mschf-glow', (0.12 + Math.sin(t/2200)*0.05*State.tempo).toFixed(3)); },
      node
    };
  };
  A.corners = () => {
    const nodes=[]; return {
      kind:'corners', cost:1,
      mount(p){ ['tl','tr','bl','br'].forEach(pos=>nodes.push(el('div',`mschf-corner mschf-corner-${pos}`,p))); },
      node:{ remove(){ nodes.forEach(n=>n.remove()); } }
    };
  };
  A.rulers = () => {
    let top,left; return {
      kind:'rulers', cost:1,
      mount(p){ top=el('div','mschf-ruler mschf-ruler-top',p); left=el('div','mschf-ruler mschf-ruler-left',p); },
      node:{ remove(){ top.remove(); left.remove(); } }
    };
  };
  A.scanline = () => {
    let node; return {
      kind:'scan', cost:1,
      mount(p){ node = el('div','mschf-scanline',p); if (State.reduceMotion) node.classList.add('static'); },
      update(){ if (!State.reduceMotion && Math.random()<0.002) node.classList.toggle('static', Math.random()<0.5); },
      node
    };
  };

  // Ephemera
  const TAPE_LEX = [
    '"KEEP OFF"','"FOR RESEARCH ONLY"','"SANDBOX"','"SPECIMEN"','"ARCHIVE"','"EVIDENCE"','"PROTOTYPE"',
    '"ALPHA"','"BETA"','"RC1"','"NIGHTLY"','"CANARY"','"WIP"','"READ ONLY"','"NO INDEX"',
    '"GRAPH"','"VECTOR"','"RAG"','"EVAL"','"INTERFACE"','"ATLAS"','"SPARK"'
  ];
  A.tape = () => {
    let node, rect={x:0,y:0,w:0,h:0}, life=1;
    return {
      kind:'tape', cost:1,
      mount(p){
        node = el('div','mschf-tape',p);
        node.classList.add(pick(['tone-a','tone-b','tone-c']));
        node.textContent = `${pick(TAPE_LEX)} • RIG-${Math.floor(Math.random()*0xffff).toString(16).padStart(4,'0').toUpperCase()}`;
        if (Math.random() < (/(bold|loud|storm)/.test(State.mood)?0.4:0.18)) node.dataset.hazard='1';
        if (Math.random() < 0.16) node.dataset.clear='1';
        const wvw = Math.round(28 + Math.random()*52);
        const h = 26 + Math.random()*12;
        rect = findSpot(innerWidth*(wvw/100), h);
        const rot = (Math.random()-0.5) * (/(loud|storm)/.test(State.mood)?14:6);
        css(node,{ top:rect.y+'px', left:rect.x+'px', width:wvw+'vw', transform:`rotate(${rot}deg)`, opacity: State.mood==='calm'?'.20':'.32' });
      },
      update(_t,dt){
        if (State.tiers.xs) return;
        rect.x = clamp(rect.x + (Math.random()-0.5)*0.35*State.tempo, 0, innerWidth - node.offsetWidth);
        rect.y = clamp(rect.y + (Math.random()-0.5)*0.25*State.tempo, 0, innerHeight - node.offsetHeight);
        node.style.left = rect.x+'px'; node.style.top = rect.y+'px';
        life -= dt * 0.00005 * (0.6 + State.tempo);
        if (life < 0) this.dead = true;
      },
      retire(){ node.classList.add('out'); },
      node
    };
  };
  const STAMPS = ['LAB DROP','EXPERIMENTAL','UNSTABLE','READ ONLY','DECLASSIFIED','NONCANON','FOR INTERNAL USE','RETRY','RECALIBRATE','ARCHIVE ONLY'];
  A.stamp = () => {
    let node; return {
      kind:'stamp', cost:1,
      mount(p){
        node = el('div','mschf-stamp',p); node.textContent = pick(STAMPS);
        const pos = pick(['top-right','top-left','bottom-right','bottom-left']);
        const rot = (Math.random()-0.5)*12, ix=6+Math.floor(Math.random()*14), iy=8+Math.floor(Math.random()*16);
        const s={ transform:`rotate(${rot}deg)` };
        if (pos.includes('top')) s.top=iy+'%'; else s.bottom=iy+'%';
        if (pos.includes('right')) s.right=ix+'%'; else s.left=ix+'%';
        css(node, s);
      },
      node
    };
  };
  A.quotes = () => {
    let node; return {
      kind:'quotes', cost:1,
      mount(p){
        node = el('div','mschf-quotes',p);
        const idtail = Math.random().toString(36).slice(2,5).toUpperCase();
        node.textContent = `${pick(['"OBJECT"','"INTERFACE"','"ARTIFACT"','"SYSTEM"','"SPECIMEN"','"KNOWLEDGE"','"SANDBOX"','"SIMULATION"','"VECTOR"','"EMBEDDING"','"RAG"','"EVAL"'])} • ${idtail}`;
        const side = Math.random()<0.5?'right':'left', vertical = Math.random()<0.3?'top':'bottom';
        const offX = 12 + Math.floor(Math.random()*24), offY = 10 + Math.floor(Math.random()*18);
        const s={}; if(side==='right') s.right=offX+'px'; else s.left=offX+'px'; if(vertical==='top') s.top=offY+'px'; else s.bottom=offY+'px';
        s.transform = `rotate(${(Math.random()-0.5)*2.2}deg)`; css(node,s);
      },
      node
    };
  };
  A.plate = () => {
    let node, code; return {
      kind:'plate', cost:1,
      mount(p){
        node = el('div','mschf-plate',p); el('div','mschf-barcode',node); code = el('div','mschf-code',node);
        const tail = Math.random().toString(16).slice(-6).toUpperCase();
        const stamp = new Date().toISOString().slice(0,10);
        code.textContent = `SEED:${tail} • ${document.body.dataset.buildBranch || 'BR:main'} • ${stamp}`;
        css(node,{ left:'18px', top:'18px' });
      },
      node
    };
  };
  A.specimen = () => {
    let node; return {
      kind:'specimen', cost:1,
      mount(p){
        node = el('div','mschf-specimen',p);
        const id = Math.random().toString(36).slice(2,7).toUpperCase();
        const hash = (document.body.dataset.buildHash||'').slice(0,7);
        const date = (document.body.dataset.builtAt || new Date().toISOString()).slice(0,10);
        const branch = document.body.dataset.buildBranch || 'main';
        const rev = pick(['A','B','C','D']);
        const path = location?.pathname || '/';
        node.innerHTML = `<strong>SPECIMEN</strong><span>ID ${id}</span>${hash?`<span>BUILD ${hash}</span>`:''}<span>${date}</span><span>BR ${branch}</span><span>REV ${rev}</span><span>PATH ${path}</span>`;
        const side = Math.random()<0.5?'right':'left', offX = 18+Math.floor(Math.random()*24), offY = 16+Math.floor(Math.random()*20);
        const s={}; if(side==='right') s.right=offX+'px'; else s.left=offX+'px'; s.top=offY+'px'; css(node,s);
      },
      node
    };
  };

  // Lab / blueprint
  A.callout = () => {
    let node; return {
      kind:'callout', cost:1,
      mount(p){
        node = el('div','mschf-callout',p);
        const x = 8 + Math.random()*84, y = 18 + Math.random()*64, len = 8 + Math.random()*16;
        node.style.setProperty('--x', `${x}vw`); node.style.setProperty('--y', `${y}vh`); node.style.setProperty('--len', `${len}vh`);
        const labels = ['NODE','EDGE','BAYES p','Z','Δt','ID'];
        const val = Math.random().toString(36).slice(2,5).toUpperCase();
        node.textContent = `${pick(labels)} ${val} • ${(Math.random()*0.99).toFixed(2)}`;
      },
      node
    };
  };
  A.graph = () => {
    let cluster, nodes=[], edges=[]; return {
      kind:'graph', cost:2,
      mount(p){
        cluster = el('div','mschf-graph',p);
        const n = 5 + Math.floor(Math.random()*(/(loud|storm)/.test(State.mood)?12:8));
        for (let i=0;i<n;i++){ const s=el('span','mschf-graph-node',cluster); s.style.setProperty('--x', `${Math.random()*100}vw`); s.style.setProperty('--y', `${Math.random()*100}vh`); nodes.push(s); }
        const m = 3 + Math.floor(Math.random()*5);
        for (let i=0;i<m;i++){ const e=el('i','mschf-graph-edge',cluster); e.style.setProperty('--x1', `${Math.random()*100}vw`); e.style.setProperty('--y1', `${Math.random()*100}vh`); e.style.setProperty('--x2', `${Math.random()*100}vw`); e.style.setProperty('--y2', `${Math.random()*100}vh`); edges.push(e); }
      },
      update(){
        if (State.reduceMotion) return;
        for (const s of nodes){
          const x = parseFloat((s.style.getPropertyValue('--x')||'0vw')) || Math.random()*100;
          const y = parseFloat((s.style.getPropertyValue('--y')||'0vh')) || Math.random()*100;
          const nx = clamp(x + (Math.random()-.5)*.6*State.tempo, 0, 100);
          const ny = clamp(y + (Math.random()-.5)*.6*State.tempo, 0, 100);
          s.style.setProperty('--x', `${nx}vw`); s.style.setProperty('--y', `${ny}vh`);
        }
        if (Math.random()<0.02*State.tempo){
          const e = pick(edges); if (e){ e.style.setProperty('--x2', `${Math.random()*100}vw`); e.style.setProperty('--y2', `${Math.random()*100}vh`); }
        }
      },
      node:{ remove(){ cluster.remove(); } }
    };
  };
  A.ringsDOM = () => { // fallback if GPU disabled
    let node; return {
      kind:'rings', cost:1,
      mount(p){ node = el('div','mschf-rings',p); if (State.reduceMotion) node.classList.add('static'); const s = 120 + Math.floor(Math.random()*220); css(node,{ left:`${10+Math.random()*80}%`, top:`${10+Math.random()*70}%`, width:s+'px', height:s+'px' }); },
      node
    };
  };
  A.topoDOM = () => { let node; return { kind:'topo', cost:1, mount(p){ node=el('div','mschf-topo',p); node.style.setProperty('--rot', `${Math.floor((Math.random()-0.5)*30)}deg`); }, node }; };
  A.halftone = () => { let node; return { kind:'halftone', cost:1, mount(p){ node=el('div','mschf-halftone '+pick(['tl','tr','bl','br']),p); }, node }; };
  A.perf = () => { let node; return { kind:'perf', cost:1, mount(p){ node=el('div','mschf-perf',p); node.dataset.side = pick(['top','bottom','left','right']); }, node }; };
  A.starfieldDOM = () => { let node; return { kind:'stars', cost:1, mount(p){ node=el('div','mschf-stars',p); node.style.setProperty('--density', `${0.15 + Math.random()*0.35}`); }, node }; };

  // Frame & stickers
  A.brackets = () => { let node; return { kind:'brackets', cost:1, mount(p){ node=el('div','mschf-brackets',p); node.classList.add(pick(['tight','wide'])); }, node }; };
  A.glitch = () => { let node; return { kind:'glitch', cost:1, mount(p){ node=el('div','mschf-glitch',p); if (State.reduceMotion) node.classList.add('static'); css(node,{ top:Math.floor(Math.random()*100)+'%', left:0, right:0 }); }, node }; };
  A.watermark = () => { let node; return { kind:'watermark', cost:1, mount(p){ node=el('div','mschf-watermark',p); node.textContent='EFFUSION LABS • PROTOTYPE • '; }, node }; };
  A.flowers = () => { const nodes=[]; return { kind:'flowers', cost:1, mount(p){ const n=1+Math.floor(Math.random()*(/(loud|storm)/.test(State.mood)?3:2)); for(let i=0;i<n;i++){ const fl=el('div','mschf-flower',p); const s=38+Math.floor(Math.random()*32), x=10+Math.floor(Math.random()*80), y=10+Math.floor(Math.random()*70); css(fl,{ width:s+'px', height:s+'px', left:x+'%', top:y+'%', transform:`rotate(${Math.floor((Math.random()-0.5)*180)}deg)` }); nodes.push(fl);} }, node:{ remove(){ nodes.forEach(n=>n.remove()); } } }; };
  A.holo = () => { let node; return { kind:'holo', cost:1, mount(p){ node=el('div','mschf-holo',p); if (State.reduceMotion) node.classList.add('static'); }, node }; };
  A.reg = () => { const nodes=[]; return { kind:'reg', cost:1, mount(p){ ['tl','tr','bl','br'].forEach(pos=>nodes.push(el('div','mschf-reg '+pos,p))); }, node:{ remove(){ nodes.forEach(n=>n.remove()); } } }; };
  A.dims = () => {
    let node; return {
      kind:'dims', cost:1,
      mount(p){
        node = el('div','mschf-dims',p);
        const x1 = 10 + Math.floor(Math.random()*30), x2 = x1 + 20 + Math.floor(Math.random()*35), y = 20 + Math.floor(Math.random()*60);
        node.style.setProperty('--x1', `${x1}vw`); node.style.setProperty('--x2', `${x2}vw`); node.style.setProperty('--y', `${y}vh`);
        node.textContent = `${Math.abs(x2 - x1)}vw`;
        el('span','',node);
      },
      node
    };
  };
  A.stickers = () => {
    let cluster; return {
      kind:'stickers', cost:1,
      mount(p){
        cluster = el('div','mschf-stickers',p);
        const corner = pick(['br','bl','tr','tl']); const off = 18 + Math.floor(Math.random()*18);
        const s={}; if (corner.includes('b')) s.bottom=off+'px'; else s.top=off+'px'; if (corner.includes('r')) s.right=off+'px'; else s.left=off+'px'; css(cluster,s);
        const badges = ['ALPHA','BETA','RC1','SIGNED','VOID','UNLOCKED','PASS','LAB','SIM','ARCHIVE','SANDBOX','RAG','EVAL','GRAPH','SPARK','VECTOR','EMBED','SPECIMEN','PROTO'];
        const n = 2 + Math.floor(Math.random()*4);
        for (let i=0;i<n;i++){
          const b = el('span','mschf-badge',cluster); b.textContent = pick(badges);
          pick([()=>{ b.style.fontSize='10px'; b.style.padding='5px 7px'; },()=>{ b.style.fontSize='11px'; b.style.padding='6px 8px'; },()=>{ b.style.fontSize='12px'; b.style.padding='7px 9px'; }])();
          b.style.setProperty('--rx', `${Math.floor((Math.random()-0.5)*18)}deg`);
          b.style.setProperty('--offx', `${Math.floor((Math.random()-0.5)*18)}px`);
          b.style.setProperty('--offy', `${Math.floor((Math.random()-0.5)*12)}px`);
          if (Math.random() < .25) b.style.boxShadow='0 0 0 1px color-mix(in oklab, currentColor 35%, transparent), 0 10px 18px rgba(0,0,0,.35)';
        }
      },
      node:{ remove(){ cluster.remove(); } }
    };
  };

  // ————————————————————————————————————————
  // Orchestration
  // ————————————————————————————————————————
  function composeInitial() {
    // Scaffold (always)
    mount(A.grid(),    'scaffold');
    mount(A.frame(),   'scaffold');
    mount(A.corners(), 'scaffold');
    mount(A.rulers(),  'scaffold');
    if (!State.reduceMotion && !State.tiers.xs) mount(A.scanline(), 'scaffold');

    // DOM fallback ornaments depending on style (GPU may add more)
    const waves = {
      collage:    () => { spawnEphemera(2,4); spawnLab(2,3); spawnFrame(2,4); },
      structural: () => { spawnLab(2,3); spawnFrame(1,2); },
      playful:    () => { spawnEphemera(3,5); spawnFrame(2,4); }
    };
    (waves[State.style] || waves.collage)();
  }

  function spawnEphemera(min,max){
    const bag = [A.tape, A.stamp, A.quotes, A.plate, A.specimen];
    const n = Math.floor(lerp(min, max, State.density));
    for (let i=0;i<n;i++) mount(pick(bag)(), 'ephemera');
  }
  function spawnLab(min,max){
    const gpuOK = !!State.app && !State.reduceData;
    const bag = gpuOK ? [A.callout, A.graph, A.perf] : [A.callout, A.graph, A.ringsDOM, A.topoDOM, A.halftone, A.perf, A.starfieldDOM];
    const n = Math.floor(lerp(min, max, State.density));
    for (let i=0;i<n;i++) mount(pick(bag)(), 'lab');
  }
  function spawnFrame(min,max){
    const bag = [A.brackets, A.glitch, A.watermark, A.flowers, A.holo, A.reg, A.dims, A.stickers];
    const n = Math.floor(lerp(min, max, State.density));
    for (let i=0;i<n;i++) mount(pick(bag)(), 'frame');
  }

  function recompose(){
    resetOccupancy(); computeSafeZones();
    // retire some to keep it fresh
    for (const fam of ['ephemera','lab','frame']) {
      const toRemove = Math.floor(State.families[fam].size * (0.15 + Math.random()*0.25));
      for (let i=0;i<toRemove;i++){ const a = State.families[fam].values().next().value; if (a) retire(a); }
    }
    spawnEphemera(1, Math.round(5*State.density));
    spawnLab(1, Math.round(4*State.density + (/(storm)/.test(State.mood)?2:0)));
    spawnFrame(1, Math.round(5*State.density));
  }

  function rareMoment(){
    if (State.reduceMotion || State.tiers.xs) return;
    mount(A.holo(), 'frame');
    for (let i=0;i<2;i++) mount(A.glitch(), 'frame');
    mount(A.tape(), 'ephemera');
    setTimeout(()=>mount(A.tape(),'ephemera'), 160);
  }

  function degradeDensity(){
    const fams = ['lab','frame','ephemera'];
    for (const fam of fams) {
      const n = Math.ceil(State.families[fam].size * 0.25);
      for (let i=0;i<n;i++){ const a = State.families[fam].values().next().value; if (a) retire(a); }
      if (!State.fps.bad) break;
    }
  }

  // ————————————————————————————————————————
  // Scheduler
  // ————————————————————————————————————————
  function tick(t){
    if (State.paused) return;
    requestAnimationFrame(tick);
    const dt = t - (State._t || t); State._t = t;

    // FPS sentinel
    const S = State.fps.samples; S.push(dt); if (S.length>16) S.shift();
    if (S.length===16){
      const avg = S.reduce((a,b)=>a+b,0)/S.length; State.fps.bad = avg>45;
      if (State.fps.bad) degradeDensity();
    }

    if (t - State.beats.last > State.beats.dur) State.beats.last = t;
    if (t - State.bars.last  > State.bars.dur)  { State.bars.last = t; if (Math.random()<.75) applyMood(nextMood(State.mood)); recompose(); if (Math.random()<.08) rareMoment(); }

    // DOM actors
    for (const a of Array.from(State.actors)) {
      try { a.update && a.update(t, dt); } catch {}
      if (a.dead) retire(a);
    }
    // GPU
    GPU.step(t);
  }

  // ————————————————————————————————————————
  // Observers & context
  // ————————————————————————————————————————
  function wireSections(){
    const hero = document.querySelector('.hero,[data-component~="hero"],section[id*="hero"]');
    const cta  = document.querySelector('.map-cta,[class*="map-cta"],[data-component~="map-cta"]');
    const feed = document.querySelector('.work-feed,[data-component~="work-feed"]');

    const io = new IntersectionObserver((entries)=>{
      for (const e of entries){
        if (!e.isIntersecting) continue;
        if (hero && e.target===hero) { mount(A.ringsDOM(),'lab'); mount(A.quotes(),'ephemera'); }
        if (cta && e.target===cta)   { mount(A.plate(),'ephemera'); rareMoment(); }
        if (feed && e.target===feed) { mount(A.stickers(),'frame'); mount(A.dims(),'frame'); }
      }
    }, { rootMargin:'0px 0px -20% 0px', threshold:[0.25, 0.6] });

    [hero, cta, feed].filter(Boolean).forEach(n=>io.observe(n));
  }

  // ————————————————————————————————————————
  // Visibility & events
  // ————————————————————————————————————————
  function onVisibility(){
    State.visible = !document.hidden;
    if (!State.visible) State.paused = true;
    else { State.paused = false; State.beats.last = now(); State.bars.last = now(); requestAnimationFrame(tick); }
  }

  // ————————————————————————————————————————
  // Boot
  // ————————————————————————————————————————
  async function boot(){
    mountRoot(); computeTiers(); computeSafeZones(); resetOccupancy();
    applyMood(State.mood);

    // GPU init (only on MD+ and if not reduced-data)
    if (!State.tiers.xs && !State.tiers.sm && !State.reduceData) {
      State.app = await GPU.init();
    }

    composeInitial();
    wireSections();
    requestAnimationFrame(tick);
  }

  // Events
  addEventListener('resize', () => { computeTiers(); computeSafeZones(); resetOccupancy(); });
  document.addEventListener('visibilitychange', onVisibility, false);

  // Reduced motion/data immediate adjustments
  if (State.reduceMotion) State.density = Math.min(State.density, .5);
  if (State.reduceData)   State.density = Math.min(State.density, .45);

  // Start
  if (document.readyState === 'complete' || document.readyState === 'interactive') requestAnimationFrame(boot);
  else document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(boot));

  // ————————————————————————————————————————
  // Console Controls
  // ————————————————————————————————————————
  window.__mschfOff = () => { localStorage.setItem('mschf:off','1'); try{ State.root?.remove(); }catch{} };
  window.__mschfOn  = () => { localStorage.removeItem('mschf:off'); location.reload(); };
  window.__mschfPulse = () => rareMoment();
  window.__mschfMood  = (m) => { if (moods.includes(m)) applyMood(m); };
  window.__mschfDensity = (x) => { State.density = clamp(+x||State.density, .1, .96); recompose(); };
})();
