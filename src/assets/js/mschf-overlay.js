// Effusion Labs — Hypebrüt Overlay v2.1 (Garden-Calm)
// Non-blocking, prose-safe, SPA-safe, mobile-sane, reduced-motion/data aware.
// Console: __mschfOn(), __mschfOff(), __mschfPulse(), __mschfMood(m), __mschfDensity(x), __mschfMask(0|1), __mschfAlpha(x)
;(() => {
  if (window.__mschfBooted) {
    try {
      console.warn('[MSCHF] Boot skipped — already booted.')
    } catch {}
    return
  }
  window.__mschfBooted = true

  // ————————————————————————————————————————
  // Debug toggles & helpers
  // Enable with: body[data-mschf-debug="1"], localStorage.setItem('mschf:debug','1'),
  // window.__MSCHF_DEBUG = true, or URL ?mschfDebug=1
  // ————————————————————————————————————————
  const q = typeof location !== 'undefined' ? location.search : ''
  const scope0 = typeof document !== 'undefined'
    ? document.body || document.documentElement
    : null
  const DEBUG = !!(
    (scope0 && scope0.dataset && scope0.dataset.mschfDebug === '1')
    || (typeof localStorage !== 'undefined'
      && localStorage.getItem('mschf:debug') === '1')
    || (typeof window !== 'undefined' && window.__MSCHF_DEBUG)
    || /(^|[&?])mschfDebug=1(&|$)/.test(q)
  )
  const SID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const C = {
    mount: 0,
    retire: 0,
    composeInitial: 0,
    recompose: 0,
    rare: 0,
    io: 0,
    beats: 0,
    bars: 0,
  }
  const qparam = name => {
    try {
      return new URLSearchParams(q).get(name)
    } catch {
      return null
    }
  }
  const log = (...a) => {
    if (DEBUG) {
      try {
        console.log('[MSCHF]', ...a)
      } catch {}
    }
  }
  const warn = (...a) => {
    if (DEBUG) {
      try {
        console.warn('[MSCHF]', ...a)
      } catch {}
    }
  }
  const group = label =>
    DEBUG
    && console.groupCollapsed
    && console.groupCollapsed(`[MSCHF] ${label}`)
  const groupEnd = () => DEBUG && console.groupEnd && console.groupEnd()
  try {
    if (DEBUG) console.info('[MSCHF] Debug ON — session', SID)
  } catch {}

  // ————————————————————————————————————————
  // Guards / kill switch
  // ————————————————————————————————————————
  const scope = document.body || document.documentElement
  if (!scope) return
  if (scope.dataset.mschf === 'off') return
  if (localStorage.getItem('mschf:off') === '1') return
  if (DEBUG) {
    scope.dataset.mschfDebug = '1'
    log('Booting overlay…', { session: SID, dataset: { ...scope.dataset } })
  }

  // ————————————————————————————————————————
  // Utilities
  // ————————————————————————————————————————
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const lerp = (a, b, t) => a + (b - a) * t
  const now = () => performance.now()
  const pick = arr => arr[Math.floor(Math.random() * arr.length)]
  const css = (el, obj) => {
    for (const k in obj) el.style[k] = obj[k]
    return el
  }
  const el = (tag, cls, parent) => {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    ;(parent || document.body).appendChild(n)
    // harden pass-through on *every* node we create
    n.style.pointerEvents = 'none'
    n.style.userSelect = 'none'
    // Debug tagging: attach actor metadata to all created nodes during a mount()
    try {
      if (State && State._mountCtx) {
        n.dataset.mschf = '1'
        n.dataset.mschfKind = State._mountCtx.kind || 'unknown'
        n.dataset.mschfFamily = State._mountCtx.family || 'unknown'
        n.dataset.mschfId = String(State._mountCtx.id || '0')
        // helper classes for quick CSS targeting
        if (State._mountCtx.kind) {
          n.classList.add(`mschf-k-${State._mountCtx.kind}`)
        }
        if (State._mountCtx.family) {
          n.classList.add(`mschf-f-${State._mountCtx.family}`)
        }
      }
    } catch {}
    return n
  }
  const HYPERBRUT_PALETTES = [
    {
      name: 'acid-lab',
      tokens: {
        ink: '#f6f8ff',
        'ink-soft': 'rgba(246, 248, 255, 0.68)',
        grid: 'rgba(246, 248, 255, 0.12)',
        'grid-alt': 'rgba(12, 247, 254, 0.14)',
        pop: '#ff2e63',
        'pop-alt': '#12fce6',
        'pop-bold': '#f9ff33',
        wire: 'rgba(255, 255, 255, 0.38)',
        glow: 'rgba(255, 46, 99, 0.6)',
        halo: 'rgba(12, 247, 254, 0.45)',
        paper: 'rgba(10, 9, 23, 0.82)',
        noise: '0.06',
        shadow: 'rgba(0, 0, 0, 0.42)',
        scan: 'rgba(12, 247, 254, 0.45)',
        'scan-tail': 'rgba(255, 46, 99, 0.2)',
        plate: 'rgba(12, 14, 25, 0.88)',
        tape: '#111318',
      },
    },
    {
      name: 'infra-mag',
      tokens: {
        ink: '#fefcf8',
        'ink-soft': 'rgba(254, 252, 248, 0.68)',
        grid: 'rgba(254, 252, 248, 0.12)',
        'grid-alt': 'rgba(255, 95, 163, 0.15)',
        pop: '#ff4d5a',
        'pop-alt': '#8c54ff',
        'pop-bold': '#00f6ff',
        wire: 'rgba(255, 200, 200, 0.42)',
        glow: 'rgba(255, 77, 90, 0.62)',
        halo: 'rgba(140, 84, 255, 0.55)',
        paper: 'rgba(22, 6, 24, 0.82)',
        noise: '0.05',
        shadow: 'rgba(0, 0, 0, 0.5)',
        scan: 'rgba(255, 77, 90, 0.45)',
        'scan-tail': 'rgba(140, 84, 255, 0.2)',
        plate: 'rgba(28, 10, 47, 0.9)',
        tape: '#1a0f26',
      },
    },
    {
      name: 'proto-cyan',
      tokens: {
        ink: '#f5fffb',
        'ink-soft': 'rgba(245, 255, 251, 0.7)',
        grid: 'rgba(245, 255, 251, 0.11)',
        'grid-alt': 'rgba(0, 255, 188, 0.18)',
        pop: '#00ffbc',
        'pop-alt': '#ff6ad5',
        'pop-bold': '#f9ff6a',
        wire: 'rgba(150, 255, 230, 0.4)',
        glow: 'rgba(0, 255, 188, 0.52)',
        halo: 'rgba(255, 106, 213, 0.38)',
        paper: 'rgba(5, 14, 12, 0.85)',
        noise: '0.045',
        shadow: 'rgba(0, 0, 0, 0.4)',
        scan: 'rgba(0, 255, 188, 0.45)',
        'scan-tail': 'rgba(255, 106, 213, 0.25)',
        plate: 'rgba(8, 24, 24, 0.88)',
        tape: '#041814',
      },
    },
    {
      name: 'hazard-sonar',
      tokens: {
        ink: '#fcf7ff',
        'ink-soft': 'rgba(252, 247, 255, 0.7)',
        grid: 'rgba(252, 247, 255, 0.1)',
        'grid-alt': 'rgba(255, 195, 0, 0.22)',
        pop: '#ffc300',
        'pop-alt': '#ff005c',
        'pop-bold': '#6efff0',
        wire: 'rgba(255, 195, 0, 0.5)',
        glow: 'rgba(255, 0, 92, 0.55)',
        halo: 'rgba(255, 195, 0, 0.45)',
        paper: 'rgba(20, 6, 6, 0.82)',
        noise: '0.05',
        shadow: 'rgba(0, 0, 0, 0.55)',
        scan: 'rgba(255, 195, 0, 0.42)',
        'scan-tail': 'rgba(255, 0, 92, 0.22)',
        plate: 'rgba(32, 12, 12, 0.88)',
        tape: '#1a0909',
      },
    },
  ]
  const pickPalette = prefer => {
    let pool = HYPERBRUT_PALETTES
    if (prefer) {
      const wants = Array.isArray(prefer) ? prefer : [prefer]
      const matches = wants
        .map(name => HYPERBRUT_PALETTES.find(p => p.name === name))
        .filter(Boolean)
      if (matches.length) {
        const keep = Math.random() < 0.85
        pool = keep ? matches : HYPERBRUT_PALETTES
      }
    }
    const base = { ...pick(pool) }
    const tokens = { ...(base.tokens || {}) }
    if (Math.random() < 0.35) {
      ;[tokens.pop, tokens['pop-alt']] = [tokens['pop-alt'], tokens.pop]
    }
    if (Math.random() < 0.25) {
      tokens['pop-bold'] = tokens['pop-alt'] || tokens.pop
    }
    return {
      name: base.name,
      tokens,
      seed: Math.random().toString(16).slice(2, 6),
    }
  }
  const applyPaletteTokens = root => {
    if (!root || !State || !State.palette) return
    root.dataset.mschfPalette = State.palette.name || ''
    root.dataset.mschfPaletteSeed = State.palette.seed || ''
    for (const [key, value] of Object.entries(State.palette.tokens || {})) {
      if (value != null) root.style.setProperty(`--mschf-${key}`, value)
    }
  }

  const SCENE_PROFILES = {
    default: {
      allowRare: true,
      nodeBudget: 110,
      capOverrides: null,
      blockKinds: [],
      allowKinds: null,
      palette: null,
    },
    essay: {
      allowRare: false,
      nodeBudget: 72,
      capOverrides: { ephemera: 3, lab: 2, frame: 3 },
      blockKinds: [
        'scan',
        'graph',
        'watermark',
        'glitch',
        'flowers',
        'holo',
        'rings',
        'topo',
        'halftone',
        'perf',
        'stars',
      ],
      allowKinds: null,
      palette: ['proto-cyan', 'acid-lab'],
      density: { max: 0.32, target: 0.26 },
      style: 'structural-lite',
    },
  }

  const syncRootSceneDataset = () => {
    if (State?.root && State.scene) {
      State.root.dataset.mschfProfile = State.scene.profile || 'default'
    }
  }

  function applySceneProfile(name, { refresh = false } = {}) {
    const profile = name && SCENE_PROFILES[name] ? name : 'default'
    const rule = SCENE_PROFILES[profile] || SCENE_PROFILES.default
    const prevProfile = State.scene?.profile
    const changed = !State.scene || prevProfile !== profile || refresh
    State.scene = {
      profile,
      allowRare: rule.allowRare !== false,
      blockKinds: new Set(rule.blockKinds || []),
      allowKinds: rule.allowKinds ? new Set(rule.allowKinds) : null,
      capOverrides: rule.capOverrides || null,
      nodeBudget: rule.nodeBudget || null,
      paletteBias: rule.palette || null,
      styleHint: rule.style || null,
      density: rule.density || null,
      blockFamilies: rule.blockFamilies ? new Set(rule.blockFamilies) : null,
    }

    if (State.scene.nodeBudget) {
      State.nodeBudget = Math.min(State.nodeBudget, State.scene.nodeBudget)
    }

    if (State.scene.density?.max != null) {
      State.density = Math.min(State.density, State.scene.density.max)
    }
    if (State.scene.density?.target != null) {
      const target = State.scene.density.target
      State.density = lerp(State.density, target, 0.55)
    }

    if (!State.scene.allowRare) {
      State.config.rare = false
    }
    if (State.scene.blockKinds.has('rings') && scope.dataset.mschfRings == null) {
      State.config.rings = false
    }
    if (State.scene.blockKinds.has('topo') && scope.dataset.mschfTopo == null) {
      State.config.topo = false
    }
    if (State.scene.blockKinds.has('stars')) {
      State.config.gpuStars = false
    }
    if (State.scene.blockKinds.has('rings')) {
      State.config.gpuRings = false
    }
    if (State.scene.blockKinds.has('topo')) {
      State.config.gpuTopo = false
    }

    if (State.scene.styleHint && State.style === 'auto') {
      State.style = 'structural'
    }

    if (
      State.scene.paletteBias
      && (!State.palette || !Array.isArray(State.scene.paletteBias)
        || !State.scene.paletteBias.includes(State.palette.name))
    ) {
      State.palette = pickPalette(State.scene.paletteBias)
      if (State.root) applyPaletteTokens(State.root)
    }

    syncRootSceneDataset()
    return changed
  }

  function detectSceneProfile() {
    const forced = scope.dataset.mschfProfile
      || document.documentElement.dataset.mschfProfile
    if (forced) return forced.toLowerCase()

    if (
      document.querySelector(
        '[data-overlay-profile="essay"],[data-mschf-profile="essay"],[data-longform="1"]',
      )
    ) {
      return 'essay'
    }

    const textContainers = [
      ...document.querySelectorAll(
        'main .prose, article, [data-kind~="report"], [data-kind~="essay"], [data-scope="longform"]',
      ),
    ]
    let words = 0
    let paragraphs = 0
    textContainers.forEach(node => {
      if (words > 2200) return
      const text = (node.textContent || '').trim().slice(0, 8000)
      if (!text) return
      paragraphs += node.querySelectorAll ? node.querySelectorAll('p').length : 0
      words += text.split(/\s+/).filter(Boolean).length
    })
    const media = document.querySelectorAll(
      'main .prose img, main .prose picture, main .prose video, article img, article picture, article video',
    ).length
    const mediaRatio = words ? media / words : 0
    if (words >= 700 && paragraphs >= 8 && mediaRatio < 0.01) {
      return 'essay'
    }

    return 'default'
  }

  function evaluateSceneProfile({ force = false } = {}) {
    const profile = detectSceneProfile()
    const changed = applySceneProfile(profile, { refresh: force })
    return changed
  }

  function isKindAllowedByScene(kind, family) {
    if (!State.scene || !kind) return true
    if (State.scene.blockKinds?.has(kind)) return false
    if (State.scene.allowKinds && !State.scene.allowKinds.has(kind)) return false
    if (State.scene.blockFamilies?.has?.(family)) return false
    return true
  }

  const filterAllowedFactories = (factories, family) =>
    factories.filter(fn => fn && isKindAllowedByScene(fn.kind, family))

  // External dep loader (PixiJS v8)
  async function loadPixi() {
    if (globalThis.PIXI && globalThis.PIXI.Application) return globalThis.PIXI

    const sources = [
      [
        'https://cdn.jsdelivr.net/npm/pixi.js@8.2.1/dist/pixi.min.mjs',
        () =>
          import(
            /* @vite-ignore */
            'https://cdn.jsdelivr.net/npm/pixi.js@8.2.1/dist/pixi.min.mjs'
          ),
      ],
      [
        'https://esm.sh/pixi.js@8',
        () => import(/* @vite-ignore */ 'https://esm.sh/pixi.js@8'),
      ],
      [
        'https://cdn.skypack.dev/pixi.js@8',
        () => import(/* @vite-ignore */ 'https://cdn.skypack.dev/pixi.js@8'),
      ],
    ]

    for (const [url, importer] of sources) {
      try {
        const mod = await importer()
        return mod?.default || mod
      } catch (error) {
        try {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn(
              `[mschf-overlay] Failed to load Pixi from ${url}`,
              error && error.message ? error.message : error,
            )
          }
        } catch {}
      }
    }

    return null
  }

  function resolveBlend(PIXI, name) {
    const map = PIXI?.BLEND_MODES
    return map && map[name] !== undefined
      ? map[name]
      : name.toLowerCase().replace(/_/g, '-')
  }

  // ————————————————————————————————————————
  // Global State
  // ————————————————————————————————————————
  const State = {
    root: null,
    domLayer: null,
    app: null,
    palette: pickPalette(),
    style: scope.dataset.mschfStyle || 'auto',
    densityToken: scope.dataset.mschfDensity || 'calm',
    density: 0.38, // gentler default
    mood: 'calm', // calm → lite → bold → loud → storm → studio
    tempo: 1.0,
    reduceMotion: matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    reduceData: !!(
      navigator.connection
      && (navigator.connection.saveData
        || /2g/.test(navigator.connection.effectiveType || ''))
    ),
    visible: !document.hidden,
    nodeBudget: 120,
    nodeCount: 0,
    scene: { profile: 'default', allowRare: true, blockKinds: new Set() },
    actors: new Set(),
    updaters: new Set(),
    _actorsDirty: true,
    _updatersDirty: true,
    _actorList: [],
    _updaterList: [],
    families: {
      scaffold: new Set(),
      ephemera: new Set(),
      lab: new Set(),
      frame: new Set(),
    },
    beats: { last: now(), dur: 680 },
    bars: { last: now(), dur: 4200 },
    safeZones: [],
    occupancy: [],
    actorBoxes: new Map(), // id -> rect {x,y,w,h}
    cornerSlots: { tl: null, tr: null, bl: null, br: null },
    readingPressure: 0,
    gridCols: 10,
    gridRows: 6,
    paused: false,
    fps: { samples: [], bad: false },
    tiers: { xs: false, sm: false, md: false, lg: false },
    // hard caps per family to bound DOM churn; recomputed by tier/pressure
    caps: { scaffold: 6, ephemera: 6, lab: 4, frame: 5 },
    alpha: 0.85, // overall overlay alpha (debuggable)
    gpu: { maskOn: true, stageAlpha: 1.0 },
    // runtime config knobs
    config: {
      // 'once' (default): single recomposition; 'auto': periodic; 'off': never after initial
      recompose: (
        scope.dataset.mschfRecompose
        || qparam('mschfRecompose')
        || 'once'
      ).toLowerCase(),
      // Default rare moments OFF; enable with data-mschf-rare="1" or ?mschfRare=1
      rare: (() => {
        const a = scope.dataset.mschfRare
        const b = qparam('mschfRare')
        return a !== undefined ? a === '1' : b === '1'
      })(),
      // Visual toggles for specific lab elements
      rings: (() => {
        const a = scope.dataset.mschfRings
        const p = qparam('mschfRings')
        return a != null ? a !== '0' : p != null ? p !== '0' : true
      })(),
      topo: (() => {
        const a = scope.dataset.mschfTopo
        const p = qparam('mschfTopo')
        return a != null ? a !== '0' : p != null ? p !== '0' : true
      })(),
      // GPU-layer toggles (default off for calm sites)
      gpuRings: (() => {
        const a = scope.dataset.mschfGpuRings
        const p = qparam('mschfGpuRings')
        return a != null ? a !== '0' : p != null ? p !== '0' : false
      })(),
      gpuTopo: (() => {
        const a = scope.dataset.mschfGpuTopo
        const p = qparam('mschfGpuTopo')
        return a != null ? a !== '0' : p != null ? p !== '0' : false
      })(),
      gpuStars: (() => {
        const a = scope.dataset.mschfGpuStars
        const p = qparam('mschfGpuStars')
        return a != null ? a !== '0' : p != null ? p !== '0' : false
      })(),
    },
    _didRecompose: false,
    _t0: now(),
    debug: {
      // Aggressive when DEBUG=true (?mschfDebug=1), quiet otherwise
      labelsOn: (() => {
        const p = qparam('mschfLabels')
        const d = scope.dataset.mschfLabels
        return p != null ? p !== '0' : d != null ? d !== '0' : DEBUG
      })(),
      hudOn: (() => {
        const p = qparam('mschfHUD')
        const d = scope.dataset.mschfHud
        return p != null ? p !== '0' : d != null ? d !== '0' : DEBUG
      })(),
      autoPick: (() => {
        const p = qparam('mschfAutoPick')
        const d = scope.dataset.mschfPick
        return p != null ? p !== '0' : d != null ? d !== '0' : DEBUG
      })(),
      lastLabelUpdate: 0,
    },
    _labels: new Map(),
    labelLayer: null,
    hud: null,
  }

  // Density from token (softened a touch)
  const densityMap = { calm: 0.22, lite: 0.38, bold: 0.58, loud: 0.75 }
  if (densityMap[State.densityToken]) {
    State.density = densityMap[State.densityToken]
  }

  // Style: default to calm+structural for clarity
  if (State.style === 'auto') State.style = 'structural'

  // ————————————————————————————————————————
  // Root mount
  // ————————————————————————————————————————
  function mountRoot() {
    let root = document.getElementById('mschf-overlay-root')
    if (!root) {
      root = el('div', '', document.body)
      root.id = 'mschf-overlay-root'
      DEBUG && log('Created overlay root')
    } else {
      DEBUG
        && log('Reusing overlay root', { childCount: root.childElementCount })
    }
    if (!State.palette) State.palette = pickPalette()
    css(root, {
      pointerEvents: 'none',
      userSelect: 'none',
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      zIndex: getComputedStyle(document.documentElement)
        .getPropertyValue('--mschf-z')
        ?.trim() || '44',
      color: 'currentColor',
      contain: 'layout style paint',
      contentVisibility: 'auto',
      opacity: State.alpha, // global soften
    })
    root.setAttribute('aria-hidden', 'true')
    root.dataset.mschfSession = SID
    applyPaletteTokens(root)
    syncRootSceneDataset()
    if (root.childElementCount) {
      DEBUG && warn('Root was not empty before mount; clearing')
    }
    root.innerHTML = ''
    const domLayer = el('div', 'mschf-layer', root)
    css(domLayer, {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      userSelect: 'none',
    })
    // dev label layer
    const labelLayer = el('div', 'mschf-devlayer', root)
    css(labelLayer, {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      userSelect: 'none',
    })
    const hud = el('div', 'mschf-hud', root)
    css(hud, {
      position: 'fixed',
      left: '6px',
      top: '6px',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: '999999',
      color: '#00ff41',
      background: 'rgba(0,0,0,.58)',
      border: '1px solid rgba(0,255,65,.6)',
      borderRadius: '6px',
      padding: '6px 8px',
      font: '700 10px/1.2 ui-monospace,Menlo,monospace',
      letterSpacing: '.06em',
    })
    if (!State.debug.hudOn) {
      hud.style.display = 'none'
    }
    State.root = root
    State.domLayer = domLayer
    State.labelLayer = labelLayer
    State.hud = hud
    applyPaletteTokens(State.root)
    if (DEBUG && 'MutationObserver' in window) {
      const mo = new MutationObserver(muts => {
        let added = 0,
          removed = 0
        for (const m of muts) {
          added += m.addedNodes?.length || 0
          removed += m.removedNodes?.length || 0
        }
        if (added || removed) {
          log('DOM layer mutation', {
            added,
            removed,
            childCount: State.domLayer?.childElementCount || 0,
            actors: State.actors.size,
            families: {
              scaffold: State.families.scaffold.size,
              ephemera: State.families.ephemera.size,
              lab: State.families.lab.size,
              frame: State.families.frame.size,
            },
            caps: State.caps,
            nodeBudget: State.nodeBudget,
            nodeCount: State.nodeCount,
          })
        }
      })
      mo.observe(domLayer, { childList: true })
      State._mo = mo
    }
  }

  // ————————————————————————————————————————
  // Mobile tiers + budgets
  // ————————————————————————————————————————
  function computeTiers() {
    const w = innerWidth
    State.tiers.xs = w < 480
    State.tiers.sm = w >= 480 && w < 768
    State.tiers.md = w >= 768 && w < 1024
    State.tiers.lg = w >= 1024

    // tiered budgets
    State.nodeBudget = State.tiers.lg ? 110 : State.tiers.md ? 90 : 60
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      State.nodeBudget = Math.min(State.nodeBudget, 70)
    }

    computeCaps()
  }

  // ————————————————————————————————————————
  // Safe zones & placement
  // ————————————————————————————————————————
  function computeSafeZones() {
    const selFallback =
      '.prose, main, article, header, nav, .map-cta, [data-safe], [data-mschf-safe], [data-occlude="avoid"]'
    const sel = scope.getAttribute('data-mschf-safe') || selFallback
    const pad = 24 // ↑ from 16
    const rects = [...document.querySelectorAll(sel)]
      .map(n => n.getBoundingClientRect())
      .filter(r => r.width * r.height > 0)
      .map(r => ({
        x: clamp(r.left - pad, 0, innerWidth),
        y: clamp(r.top - pad, 0, innerHeight),
        w: clamp(r.width + pad * 2, 0, innerWidth),
        h: clamp(r.height + pad * 2, 0, innerHeight),
      }))
    State.safeZones = rects
    GPU.updateMask() // keep GPU from painting over prose
  }

  // Clip each rect to the viewport; measure visible text only
  function computeReadingPressure() {
    const W = innerWidth,
      H = innerHeight
    const clip = r =>
      Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0))
      * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0))

    let area = 0
    document.querySelectorAll('p, li, blockquote').forEach(n => {
      const r = n.getBoundingClientRect()
      area += clip(r)
    })
    const total = W * H || 1
    State.readingPressure = clamp(area / total, 0, 1)
  }
  function computeContext() {
    computeSafeZones()
    computeReadingPressure()
    evaluateSceneProfile()
    computeCaps()
  }

  // Recompute per-family caps by tier, density, motion, and reading pressure
  function computeCaps() {
    const base = State.tiers.lg
      ? { ephemera: 8, lab: 6, frame: 6 }
      : State.tiers.md
      ? { ephemera: 6, lab: 4, frame: 5 }
      : { ephemera: 3, lab: 2, frame: 3 }
    const pressureMod = State.readingPressure > 0.25 ? 0.6 : 1.0
    const motionMod = State.reduceMotion ? 0.75 : 1.0
    const densityMod = lerp(0.6, 1.0, clamp(State.density, 0.2, 0.8))
    State.caps = {
      scaffold: 6,
      ephemera: Math.max(
        1,
        Math.floor(base.ephemera * pressureMod * motionMod * densityMod),
      ),
      lab: Math.max(
        1,
        Math.floor(base.lab * pressureMod * motionMod * densityMod),
      ),
      frame: Math.max(
        1,
        Math.floor(base.frame * pressureMod * motionMod * densityMod),
      ),
    }
    if (State.scene?.capOverrides) {
      for (const key of ['ephemera', 'lab', 'frame']) {
        if (State.scene.capOverrides[key] != null) {
          State.caps[key] = Math.min(State.caps[key], State.scene.capOverrides[key])
        }
      }
    }
  }
  function rectOverlap(a, b) {
    const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    return x * y
  }
  function collidesSafe(r) {
    const area = Math.max(1, r.w * r.h)
    for (const z of State.safeZones) {
      if (rectOverlap(r, z) / area > 0.02) return true // stricter
    }
    return false
  }
  function collidesActors(r) {
    const area = Math.max(1, r.w * r.h)
    for (const [, z] of State.actorBoxes) {
      if (rectOverlap(r, z) / area > 0.06) return true
    }
    return false
  }
  function collidesAny(r) {
    return collidesSafe(r) || collidesActors(r)
  }
  function resetOccupancy() {
    State.occupancy = new Array(State.gridCols * State.gridRows).fill(0)
  }
  function isCellFree(c, r) {
    return !State.occupancy[r * State.gridCols + c]
  }
  function claimCell(c, r) {
    State.occupancy[r * State.gridCols + c] = 1
  }

  // Corner occupancy manager — prevents stacking actors in corners
  const CNR = {
    all: ['tl', 'tr', 'bl', 'br'],
    free() {
      return this.all.filter(c => !State.cornerSlots[c])
    },
    isFree(c) {
      return !State.cornerSlots[c]
    },
    can(corners) {
      return corners.every(c => !State.cornerSlots[c])
    },
    pick() {
      const f = this.free()
      return f.length ? pick(f) : null
    },
    claim(actor, corners) {
      actor._corners = actor._corners || []
      for (const c of corners) {
        State.cornerSlots[c] = actor
        actor._corners.push(c)
      }
    },
    release(actor) {
      if (!actor || !actor._corners) return
      for (const c of actor._corners) {
        if (State.cornerSlots[c] === actor) State.cornerSlots[c] = null
      }
      actor._corners.length = 0
    },
  }

  // Zoned placement with optional affinity
  function findSpot(w, h, aff = 'anywhere') {
    const tryGutter = () => {
      const left = Math.random() < 0.5
      const x = left
        ? Math.round(Math.random() * Math.min(innerWidth * 0.1, 120))
        : Math.round(
          innerWidth - w - Math.random() * Math.min(innerWidth * 0.1, 120),
        )
      const y = Math.round(Math.random() * (innerHeight - h))
      const rect = { x, y, w, h }
      if (!collidesAny(rect)) return rect
      return null
    }
    const tryCorners = () => {
      const pad = 8
      const pos = pick(['tl', 'tr', 'bl', 'br'])
      const x = pos.includes('l') ? pad : innerWidth - w - pad
      const y = pos.includes('t') ? pad : innerHeight - h - pad
      const rect = { x, y, w, h }
      if (!collidesAny(rect)) return rect
      return null
    }
    const tryHeader = () => {
      const pad = 12
      const x = Math.round(Math.random() * (innerWidth - w))
      const y = pad
      const rect = { x, y, w, h }
      if (!collidesAny(rect)) return rect
      return null
    }
    const primary = aff === 'corners'
      ? tryCorners
      : aff === 'gutters'
      ? tryGutter
      : aff === 'header'
      ? tryHeader
      : null
    if (primary) {
      for (let i = 0; i < 12; i++) {
        const r = primary()
        if (r) return r
      }
    }
    if (aff !== 'gutters') {
      for (let i = 0; i < 8; i++) {
        const r = tryGutter()
        if (r) return r
      }
    }

    const maxTry = 28
    for (let i = 0; i < maxTry; i++) {
      const cx = Math.floor(Math.random() * State.gridCols)
      const cy = Math.floor(Math.random() * State.gridRows)
      if (!isCellFree(cx, cy)) continue
      const rx = Math.round((cx / State.gridCols) * innerWidth)
      const ry = Math.round((cy / State.gridRows) * innerHeight)
      const rect = {
        x: clamp(rx - w * 0.1, 0, innerWidth - w),
        y: clamp(ry - h * 0.1, 0, innerHeight - h),
        w,
        h,
      }
      if (!collidesAny(rect)) {
        claimCell(cx, cy)
        return rect
      }
    }
    return {
      x: Math.round(Math.random() * (innerWidth - w)),
      y: Math.round(Math.random() * (innerHeight - h)),
      w,
      h,
    }
  }

  // ————————————————————————————————————————
  // Mood machine (calmer + article caps)
  // ————————————————————————————————————————
  const moods = ['calm', 'lite', 'bold', 'loud', 'storm', 'studio']
  function nextMood(cur) {
    const idx = moods.indexOf(cur)
    const roll = Math.random()
    let step = roll < 0.7 ? 1 : roll < 0.92 ? 2 : 3 // drift slower
    if (State.readingPressure < 0.1 && Math.random() < 0.4) step++
    let next = moods[Math.min(idx + step, moods.length - 1)]
    if (
      State.readingPressure > 0.25
      && ['bold', 'loud', 'storm', 'studio'].includes(next)
    ) {
      next = 'lite'
    }
    return next
  }
  function applyMood(mood) {
    if (
      State.readingPressure > 0.25
      && ['bold', 'loud', 'storm', 'studio'].includes(mood)
    ) {
      mood = 'lite'
    }
    State.mood = mood

    const t = {
      calm: 0.95,
      lite: 1.0,
      bold: 1.1,
      loud: 1.18,
      storm: 1.25,
      studio: 0.95,
    }[mood] || 1.0
    State.tempo = t

    // calmer bar/beat lengths
    State.bars.dur = lerp(3400, 5200, 1 / (State.tempo + 0.01))
    State.beats.dur = lerp(580, 820, 1 / (State.tempo + 0.01))

    // density settles toward base, then capped by page type
    const base = {
      calm: 0.22,
      lite: 0.38,
      bold: 0.55,
      loud: 0.7,
      storm: 0.85,
      studio: 0.35,
    }[mood] || 0.4
    State.density = clamp(lerp(State.density, base, 0.6), 0.18, 0.9)

    const isArticle = !!document.querySelector(
      '.prose,[data-kind="spark"],[data-kind="concept"],[data-kind="project"],article,main .prose',
    )
    if (isArticle) State.density = Math.min(State.density, 0.45)
    if (State.tiers.xs || State.tiers.sm) {
      State.density = Math.min(State.density, 0.45)
    }

    if (State.root) State.root.dataset.mood = mood

    // GPU flourish guardrails
    GPU.toggleGlow(!isArticle && /loud|storm/.test(mood))
  }

  // ————————————————————————————————————————
  // GPU (PixiJS) layer — prose-masked
  // ————————————————————————————————————————
  const GPU = {
    app: null,
    stage: null,
    rings: null,
    topo: null,
    starfield: null,
    glow: null,
    maskG: null,
    async init() {
      if (State.reduceData) return null
      // Only on large screens by default
      if (!State.tiers.lg) return null
      DEBUG && log('GPU.init start')
      const PIXI = await loadPixi()
      if (!PIXI) {
        DEBUG && warn('GPU.init failed: PIXI not available')
        return null
      }

      const app = new PIXI.Application()
      await app.init({
        width: innerWidth,
        height: innerHeight,
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        powerPreference: 'high-performance',
        useBackBuffer: false,
        resolution: devicePixelRatio > 2 ? 2 : devicePixelRatio,
      })
      State.root.appendChild(app.canvas)
      css(app.canvas, {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        userSelect: 'none',
      })

      const stage = app.stage
      this.app = app
      this.stage = stage
      DEBUG && log('GPU.init ok')

      // Mask that punches holes over safe zones (so GPU never overlays prose)
      this.updateMask()

      // Rings (GPU) — optional
      if (State.config.gpuRings) {
        this.rings = this.makeRings(PIXI)
        stage.addChild(this.rings.container)
      }

      // Topo (GPU) — optional
      if (State.config.gpuTopo) {
        this.topo = this.makeTopo(PIXI)
        stage.addChild(this.topo.container)
      }

      // Starfield (very subtle) — optional
      if (State.config.gpuStars) {
        this.starfield = this.makeStars(PIXI)
        stage.addChild(this.starfield.container)
      }

      // No CRT by default (was visually heavy over text)

      // Context loss handling (recover or gracefully degrade)
      try {
        app.canvas.addEventListener(
          'webglcontextlost',
          ev => {
            ev.preventDefault()
            State._gpuLost = true
            DEBUG && warn('GPU context lost')
          },
          false,
        )
        app.canvas.addEventListener(
          'webglcontextrestored',
          () => {
            State._gpuLost = false
            DEBUG && log('GPU context restored')
            this.topo?.resize?.()
            this.rings?.resize?.()
            this.starfield?.resize?.()
          },
          false,
        )
      } catch {}

      // Resize
      addEventListener('resize', () => {
        app.renderer.resize(innerWidth, innerHeight)
        this.rings?.resize()
        this.topo?.resize()
        this.starfield?.resize()
        this.updateMask()
      })

      return app
    },

    updateMask() {
      if (!this.stage || !this.app) return
      const PIXI = this.app.renderer.plugins?.graphics?.graphicsFactory?.renderer?.PIXI
        || globalThis.PIXI
      if (!PIXI) return

      if (!this.maskG) this.maskG = new PIXI.Graphics()
      this.maskG.clear()

      if (State.gpu.maskOn) {
        this.maskG.beginFill(0xffffff, 1)
        this.maskG.drawRect(0, 0, innerWidth, innerHeight)
        for (const z of State.safeZones) {
          this.maskG.beginHole()
          this.maskG.drawRoundedRect(z.x, z.y, z.w, z.h, 8)
          this.maskG.endHole()
        }
        this.maskG.endFill()
        this.stage.mask = this.maskG
        if (!this.maskG.parent) this.stage.addChild(this.maskG)
        DEBUG && log('GPU.mask on', { holes: State.safeZones.length })
      } else {
        // mask off
        if (this.stage.mask) this.stage.mask = null
        if (this.maskG.parent) this.maskG.removeFromParent()
        DEBUG && log('GPU.mask off')
      }
    },

    toggleGlow(enable) {
      if (!this.stage || State.reduceMotion) return
      const want = !!enable
      if (want && !this.glow) {
        ;(async () => {
          try {
            const { GlowFilter } = await import(
              'https://cdn.jsdelivr.net/npm/@pixi/filter-glow@5.2.1/dist/filter-glow.min.mjs'
            ).catch(() => ({}))
            if (GlowFilter) {
              this.glow = new GlowFilter({
                distance: 10,
                outerStrength: 0.18,
                innerStrength: 0.0,
                color: 0xffffff,
                quality: 0.25,
              })
              this.stage.filters = [this.glow]
            }
          } catch {}
        })()
      } else if (!want && this.glow) {
        this.stage.filters = null
        this.glow = null
      }
    },

    makeRings(PIXI) {
      const container = new PIXI.Container()
      container.alpha = 0.08 // softer
      const g = new PIXI.Graphics()
      container.addChild(g)

      function draw(cx, cy, baseR, color) {
        g.clear()
        g.blendMode = resolveBlend(PIXI, 'ADD')
        g.lineStyle(1, color, 1)
        for (let i = 0; i < 3; i++) {
          g.drawCircle(cx, cy, baseR + i * baseR * 0.33)
        }
        g.endFill()
      }

      let cx = innerWidth * 0.5,
        cy = innerHeight * 0.28,
        base = Math.min(innerWidth, innerHeight) * 0.052
      let tint = 0xffffff

      function resize() {
        cx = innerWidth * 0.5
        cy = Math.max(64, innerHeight * 0.26)
        base = Math.min(innerWidth, innerHeight) * 0.05
      }
      function step(t) {
        if (State.reduceMotion) {
          draw(cx, cy, base, tint)
          return
        }
        const beat = 1 + Math.sin(t / 1400) * 0.05 * State.tempo
        draw(cx, cy, base * beat, tint)
      }
      resize()
      return { container, step, resize }
    },

    makeTopo(PIXI) {
      const container = new PIXI.Container()
      container.alpha = 0.06
      const g = new PIXI.Graphics()
      container.addChild(g)

      function draw() {
        g.clear()
        g.blendMode = resolveBlend(PIXI, 'SCREEN')
        const w = innerWidth,
          h = innerHeight
        const lines = 14
        for (let i = 0; i < lines; i++) {
          const y = (h / lines) * i + Math.sin(i * 1.23) * 4
          g.lineStyle(1, 0xffffff, 0.32)
          g.moveTo(0, y)
          for (let x = 0; x <= w; x += 28) {
            const yy = y
              + Math.sin(x * 0.01 + i * 0.6) * 4
              + Math.sin(x * 0.031 - i) * 2.5
            g.lineTo(x, yy)
          }
        }
      }
      function resize() {
        draw()
      }
      function step(_t) {
        if (State.reduceMotion) return
        if (Math.random() < 0.015 * State.tempo) draw()
      }
      draw()
      return { container, step, resize }
    },

    makeStars(PIXI) {
      const container = new PIXI.Container()
      container.alpha = 0.05
      container.blendMode = resolveBlend(PIXI, 'SCREEN')
      const starTex = PIXI.Texture.WHITE
      const sprites = []

      function populate() {
        container.removeChildren()
        sprites.length = 0
        const n = Math.floor(
          40 + State.density * 60 * (State.tiers.lg ? 1 : 0.6),
        )
        for (let i = 0; i < n; i++) {
          const s = new PIXI.Sprite(starTex)
          const size = Math.random() * 1.6 + 0.4
          s.tint = 0xffffff
          s.alpha = Math.random() * 0.6 + 0.2
          s.width = size
          s.height = size
          s.x = Math.random() * innerWidth
          s.y = Math.random() * innerHeight
          container.addChild(s)
          sprites.push(s)
        }
      }
      function resize() {
        populate()
      }
      function step() {
        if (State.reduceMotion || State.tiers.xs) return
        if (Math.random() < 0.25) return
        const k = State.tempo * 0.1 * (State.tiers.lg ? 1 : 0.6)
        for (let i = 0; i < sprites.length; i += 7) {
          const s = sprites[i]
          s.y += (Math.random() - 0.5) * k
          s.x += (Math.random() - 0.5) * k
          if (s.x < 0) s.x = innerWidth
          if (s.x > innerWidth) s.x = 0
          if (s.y < 0) s.y = innerHeight
          if (s.y > innerHeight) s.y = 0
        }
      }
      populate()
      return { container, step, resize }
    },

    step(t) {
      if (!this.stage) return
      this.rings?.step(t)
      this.topo?.step(t)
      this.starfield?.step(t)
      // stage alpha adapts slightly to pressure
      this.stage.alpha = State.gpu.stageAlpha = lerp(
        0.75,
        1.0,
        1 - State.readingPressure * 0.5,
      )
    },
  }

  // ————————————————————————————————————————
  // Actor Framework (DOM ornaments)
  // ————————————————————————————————————————
  function mount(actor, family) {
    if (!actor) return
    if (DEBUG) group(`mount try: ${actor.kind || 'unknown'} → ${family}`)

    if (!isKindAllowedByScene(actor.kind, family)) {
      DEBUG
        && warn('bail: scene block', {
          kind: actor.kind,
          family,
          profile: State.scene?.profile,
        })
      return void groupEnd()
    }

    // honor budget
    const cost = actor.cost || 1
    if (State.nodeCount + cost > State.nodeBudget) {
      DEBUG
        && warn('bail: nodeBudget cap', {
          nodeCount: State.nodeCount,
          cost,
          nodeBudget: State.nodeBudget,
        })
      return void groupEnd()
    }

    // family caps: bail if at capacity
    const cap = (State.caps && State.caps[family]) || Infinity
    if (State.families[family] && State.families[family].size >= cap) {
      DEBUG
        && warn('bail: family cap', {
          family,
          size: State.families[family].size,
          cap,
        })
      return void groupEnd()
    }

    const isArticle = !!document.querySelector(
      '.prose,[data-kind="spark"],[data-kind="concept"],[data-kind="project"],article,main .prose',
    )

    // Preflight: corner occupancy (avoid stacking multiple corner-bound actors)
    const wantsCorners = k => ['reg', 'pips', 'corners'].includes(k || '')
    if ((actor.kind || '') === 'stickers') {
      const chosen = CNR.pick()
      if (!chosen) {
        DEBUG && warn('bail: no free corner for stickers')
        return (DEBUG && groupEnd(), false)
      }
      actor.corner = chosen // handed to actor.mount
      CNR.claim(actor, [chosen])
    } else if (wantsCorners(actor.kind)) {
      if (!CNR.can(['tl', 'tr', 'bl', 'br'])) {
        DEBUG && warn('bail: corners occupied')
        return (DEBUG && groupEnd(), false)
      }
      CNR.claim(actor, ['tl', 'tr', 'bl', 'br'])
    }

    // small screens: only minimal scaffold & frame affordances
    if ((State.tiers.xs || State.tiers.sm) && family !== 'scaffold') {
      const allow = ['frame', 'corners', 'rulers', 'brackets', 'reg', 'dims']
      if (!allow.includes(actor.kind || '')) {
        DEBUG && warn('bail: small-screen filter', { kind: actor.kind, family })
        return void groupEnd()
      }
    }
    // articles: quiet only
    if (isArticle && family !== 'scaffold') {
      const quiet = [
        'tape',
        'quotes',
        'specimen',
        'plate',
        'dims',
        'reg',
        'brackets',
        'stickers',
      ]
      if (!quiet.includes(actor.kind || '') && State.density > 0.45) {
        DEBUG
          && warn('bail: article quiet filter', {
            kind: actor.kind,
            density: State.density,
          })
        return void groupEnd()
      }
    }

    // assign uid and expose mount context for debug tagging
    actor._id = State.seq = (State.seq || 0) + 1
    State._mountCtx = { id: actor._id, kind: actor.kind, family }
    State.families[family].add(actor)
    State.actors.add(actor)
    State._actorsDirty = true
    State.nodeCount += cost
    try {
      actor.mount(State.domLayer)
    } catch (e) {
      DEBUG && warn('actor.mount threw', e)
      CNR.release(actor)
      return (DEBUG && groupEnd(), false)
    }
    if (typeof actor.update === 'function') {
      State.updaters.add(actor)
      State._updatersDirty = true
    }
    // record bounding box to discourage future overlaps
    try {
      const r = actor.node?.getBoundingClientRect?.()
      if (r && isFinite(r.width) && isFinite(r.height)) {
        const rect = {
          x: Math.max(0, r.left),
          y: Math.max(0, r.top),
          w: Math.max(0, r.width),
          h: Math.max(0, r.height),
        }
        State.actorBoxes.set(actor._id, rect)
      }
    } catch {}
    State._mountCtx = null
    // If primary node exists, tag it too
    try {
      if (actor.node && actor.node.nodeType === 1) {
        actor.node.dataset.mschf = '1'
        actor.node.dataset.mschfKind = actor.kind || 'unknown'
        actor.node.dataset.mschfFamily = family
        actor.node.dataset.mschfId = String(actor._id)
        actor.node.classList.add(
          `mschf-k-${actor.kind || 'unknown'}`,
          `mschf-f-${family}`,
        )
      }
    } catch {}
    C.mount++
    // text and bbox for quicker mapping
    let text = ''
    try {
      text = ((actor.node && actor.node.textContent) || '').trim().slice(0, 48)
    } catch {}
    let bbox = null
    try {
      const r = actor.node?.getBoundingClientRect?.()
      if (r) {
        bbox = {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        }
      }
    } catch {}
    DEBUG
      && log('mounted', {
        id: actor._id,
        kind: actor.kind,
        family,
        text,
        bbox,
        node: actor.node,
        cost,
        nodeCount: State.nodeCount,
        sizes: {
          scaffold: State.families.scaffold.size,
          ephemera: State.families.ephemera.size,
          lab: State.families.lab.size,
          frame: State.families.frame.size,
        },
      })
    DEBUG && groupEnd()
    return true
  }
  function retire(actor) {
    if (!actor) return
    if (DEBUG) group(`retire: ${actor.kind || 'unknown'}`)
    try {
      actor.retire && actor.retire()
    } catch (e) {
      DEBUG && warn('actor.retire threw', e)
    }
    try {
      actor.node && actor.node.remove()
    } catch {}
    try {
      State.actorBoxes.delete(actor._id)
    } catch {}
    try {
      CNR.release(actor)
    } catch {}
    try {
      const lab = State._labels.get(actor._id)
      if (lab) {
        lab.remove()
        State._labels.delete(actor._id)
      }
    } catch {}
    if (State.updaters.has(actor)) {
      State.updaters.delete(actor)
      State._updatersDirty = true
    }
    State.actors.delete(actor)
    State._actorsDirty = true
    for (const k in State.families) State.families[k].delete(actor)
    State.nodeCount = Math.max(0, State.nodeCount - (actor.cost || 1))
    C.retire++
    DEBUG
      && log('retired', {
        id: actor._id,
        kind: actor.kind,
        nodeCount: State.nodeCount,
        sizes: {
          scaffold: State.families.scaffold.size,
          ephemera: State.families.ephemera.size,
          lab: State.families.lab.size,
          frame: State.families.frame.size,
        },
      })
    DEBUG && groupEnd()
  }

  const A = {} // actor factory bag

  // Scaffold (always gentle + pass-through nodes already enforced by el())
  const gridMeta = { affinity: 'anywhere', complexity: 2 }
  A.grid = () => {
    let node
    return {
      kind: 'grid',
      cost: 1,
      ...gridMeta,
      mount(p) {
        node = el('div', 'mschf-grid', p)
        node.dataset.variant = Math.random() < 0.5 ? 'dots' : 'lines'
      },
      update() {
        if (Math.random() < 0.0015 * State.tempo) {
          node.dataset.variant = node.dataset.variant === 'dots' ? 'lines' : 'dots'
        }
      },
      node,
    }
  }
  A.grid.meta = gridMeta
  const frameMeta = { affinity: 'anywhere', complexity: 2 }
  A.frame = () => {
    let node
    return {
      kind: 'frame',
      cost: 1,
      ...frameMeta,
      mount(p) {
        node = el('div', 'mschf-frame', p)
      },
      update(t) {
        node.style.setProperty(
          '--mschf-glow',
          (0.1 + Math.sin(t / 2600) * 0.04 * State.tempo).toFixed(3),
        )
      },
      node,
    }
  }
  A.frame.meta = frameMeta
  const cornersMeta = { affinity: 'corners', complexity: 1 }
  A.corners = () => {
    const nodes = []
    return {
      kind: 'corners',
      cost: 1,
      ...cornersMeta,
      mount(p) {
        ;['tl', 'tr', 'bl', 'br'].forEach(pos =>
          nodes.push(el('div', `mschf-corner mschf-corner-${pos}`, p))
        )
      },
      node: {
        remove() {
          nodes.forEach(n => n.remove())
        },
      },
    }
  }
  A.corners.meta = cornersMeta
  const rulersMeta = { affinity: 'anywhere', complexity: 1 }
  A.rulers = () => {
    let top, left
    return {
      kind: 'rulers',
      cost: 1,
      ...rulersMeta,
      mount(p) {
        top = el('div', 'mschf-ruler mschf-ruler-top', p)
        left = el('div', 'mschf-ruler mschf-ruler-left', p)
      },
      node: {
        remove() {
          top.remove()
          left.remove()
        },
      },
    }
  }
  A.rulers.meta = rulersMeta
  const scanMeta = { affinity: 'anywhere', complexity: 2 }
  A.scanline = () => {
    let node
    return {
      kind: 'scan',
      cost: 1,
      ...scanMeta,
      mount(p) {
        node = el('div', 'mschf-scanline', p)
        if (State.reduceMotion) {
          node.classList.add('static')
        } else {
          const speed = 6.5 + Math.random() * 5.5
          node.style.setProperty('--mschf-scan-speed', speed.toFixed(2) + 's')
          node.style.setProperty(
            '--mschf-scan-delay',
            (-Math.random() * speed).toFixed(2) + 's',
          )
        }
      },
      update() {
        if (!node || State.reduceMotion) return
        if (Math.random() < 0.0009) {
          node.classList.toggle('static', Math.random() < 0.35)
        }
        if (Math.random() < 0.0006) {
          const speed = 6 + Math.random() * 6
          node.style.setProperty('--mschf-scan-speed', speed.toFixed(2) + 's')
          node.style.setProperty(
            '--mschf-scan-delay',
            (-Math.random() * speed).toFixed(2) + 's',
          )
        }
      },
      node,
    }
  }
  A.scanline.meta = scanMeta

  // Ephemera (mostly gutters/corners)
  const TAPE_LEX = [
    '"KEEP OFF"',
    '"FOR RESEARCH ONLY"',
    '"SANDBOX"',
    '"SPECIMEN"',
    '"ARCHIVE"',
    '"EVIDENCE"',
    '"PROTOTYPE"',
    '"ALPHA"',
    '"BETA"',
    '"RC1"',
    '"NIGHTLY"',
    '"CANARY"',
    '"WIP"',
    '"READ ONLY"',
    '"NO INDEX"',
    '"GRAPH"',
    '"VECTOR"',
    '"RAG"',
    '"EVAL"',
    '"INTERFACE"',
    '"ATLAS"',
    '"SPARK"',
  ]
  const tapeMeta = { affinity: 'corners', complexity: 2 }
  A.tape = () => {
    let node,
      rect = { x: 0, y: 0, w: 0, h: 0 },
      life = 1
    return {
      kind: 'tape',
      cost: 1,
      ...tapeMeta,
      mount(p) {
        node = el('div', 'mschf-tape', p)
        node.classList.add(pick(['tone-a', 'tone-b', 'tone-c']))
        node.textContent = `${pick(TAPE_LEX)} • RIG-${
          Math.floor(
            Math.random() * 0xffff,
          )
            .toString(16)
            .padStart(4, '0')
            .toUpperCase()
        }`
        if (
          Math.random() < (/(bold|loud|storm)/.test(State.mood) ? 0.35 : 0.15)
        ) {
          node.dataset.hazard = '1'
        }
        if (Math.random() < 0.14) node.dataset.clear = '1'
        const wvw = Math.round(24 + Math.random() * 44)
        const h = 24 + Math.random() * 10
        rect = findSpot(innerWidth * (wvw / 100), h, this.affinity)
        const rot = (Math.random() - 0.5) * (/(loud|storm)/.test(State.mood) ? 12 : 5)
        css(node, {
          top: rect.y + 'px',
          left: rect.x + 'px',
          width: wvw + 'vw',
          transform: `rotate(${rot}deg)`,
          opacity: State.mood === 'calm' ? '.18' : '.28',
        })
      },
      update(_t, dt) {
        if (State.tiers.xs) return
        rect.x = clamp(
          rect.x + (Math.random() - 0.5) * 0.28 * State.tempo,
          0,
          innerWidth - (node.offsetWidth || 0),
        )
        rect.y = clamp(
          rect.y + (Math.random() - 0.5) * 0.2 * State.tempo,
          0,
          innerHeight - (node.offsetHeight || 0),
        )
        node.style.left = rect.x + 'px'
        node.style.top = rect.y + 'px'
        life -= dt * 0.00005 * (0.6 + State.tempo)
        if (life < 0) this.dead = true
      },
      retire() {
        node.classList.add('out')
      },
      node,
    }
  }
  A.tape.meta = tapeMeta

  const STAMPS = [
    'LAB DROP',
    'EXPERIMENTAL',
    'UNSTABLE',
    'READ ONLY',
    'DECLASSIFIED',
    'NONCANON',
    'INTERNAL',
    'RETRY',
    'RECALIBRATE',
    'ARCHIVE ONLY',
  ]
  const stampMeta = { affinity: 'corners', complexity: 2 }
  A.stamp = () => {
    let node
    return {
      kind: 'stamp',
      cost: 1,
      ...stampMeta,
      mount(p) {
        node = el('div', 'mschf-stamp', p)
        node.textContent = pick(STAMPS)
        const pos = pick([
          'top-right',
          'top-left',
          'bottom-right',
          'bottom-left',
        ])
        const rot = (Math.random() - 0.5) * 10,
          ix = 6 + Math.floor(Math.random() * 14),
          iy = 8 + Math.floor(Math.random() * 16)
        const s = { transform: `rotate(${rot}deg)` }
        if (pos.includes('top')) s.top = iy + '%'
        else s.bottom = iy + '%'
        if (pos.includes('right')) s.right = ix + '%'
        else s.left = ix + '%'
        css(node, s)
      },
      node,
    }
  }
  A.stamp.meta = stampMeta

  const quotesMeta = { affinity: 'anywhere', complexity: 1 }
  A.quotes = () => {
    let node
    return {
      kind: 'quotes',
      cost: 1,
      ...quotesMeta,
      mount(p) {
        node = el('div', 'mschf-quotes', p)
        const idtail = Math.random().toString(36).slice(2, 5).toUpperCase()
        node.textContent = `${
          pick([
            '"OBJECT"',
            '"INTERFACE"',
            '"ARTIFACT"',
            '"SYSTEM"',
            '"SPECIMEN"',
            '"SANDBOX"',
            '"VECTOR"',
            '"EMBEDDING"',
            '"RAG"',
            '"EVAL"',
          ])
        } • ${idtail}`
        const side = Math.random() < 0.5 ? 'right' : 'left',
          vertical = Math.random() < 0.3 ? 'top' : 'bottom'
        const offX = 12 + Math.floor(Math.random() * 24),
          offY = 10 + Math.floor(Math.random() * 18)
        const s = {}
        if (side === 'right') s.right = offX + 'px'
        else s.left = offX + 'px'
        if (vertical === 'top') s.top = offY + 'px'
        else s.bottom = offY + 'px'
        s.transform = `rotate(${(Math.random() - 0.5) * 2.0}deg)`
        css(node, s)
      },
      node,
    }
  }
  A.quotes.meta = quotesMeta

  const plateMeta = { affinity: 'gutters', complexity: 3 }
  A.plate = () => {
    let node, code
    return {
      kind: 'plate',
      cost: 1,
      ...plateMeta,
      mount(p) {
        node = el('div', 'mschf-plate', p)
        el('div', 'mschf-barcode', node)
        code = el('div', 'mschf-code', node)
        const tail = Math.random().toString(16).slice(-6).toUpperCase()
        const stamp = new Date().toISOString().slice(0, 10)
        code.textContent = `SEED:${tail} • ${
          document.body.dataset.buildBranch || 'BR:main'
        } • ${stamp}`
        css(node, { left: '18px', top: '18px' })
      },
      node,
    }
  }
  A.plate.meta = plateMeta

  const specimenMeta = { affinity: 'gutters', complexity: 2 }
  A.specimen = () => {
    let node
    return {
      kind: 'specimen',
      cost: 1,
      ...specimenMeta,
      mount(p) {
        node = el('div', 'mschf-specimen', p)
        const id = Math.random().toString(36).slice(2, 7).toUpperCase()
        const hash = (document.body.dataset.buildHash || '').slice(0, 7)
        const date = (
          document.body.dataset.builtAt || new Date().toISOString()
        ).slice(0, 10)
        const branch = document.body.dataset.buildBranch || 'main'
        const rev = pick(['A', 'B', 'C', 'D'])
        const path = location?.pathname || '/'
        node.innerHTML = `<strong>SPECIMEN</strong><span>ID ${id}</span>${
          hash ? `<span>BUILD ${hash}</span>` : ''
        }<span>${date}</span><span>BR ${branch}</span><span>REV ${rev}</span><span>PATH ${path}</span>`
        const side = Math.random() < 0.5 ? 'right' : 'left',
          offX = 18 + Math.floor(Math.random() * 24),
          offY = 16 + Math.floor(Math.random() * 20)
        const s = {}
        if (side === 'right') s.right = offX + 'px'
        else s.left = offX + 'px'
        s.top = offY + 'px'
        css(node, s)
      },
      node,
    }
  }
  A.specimen.meta = specimenMeta

  // Lab / blueprint
  const calloutMeta = { affinity: 'gutters', complexity: 1 }
  A.callout = () => {
    let node
    return {
      kind: 'callout',
      cost: 1,
      ...calloutMeta,
      mount(p) {
        node = el('div', 'mschf-callout', p)
        const labels = ['NODE', 'EDGE', 'VECTOR', 'EVAL', 'β', 'Δt', 'ID']
        const val = Math.random().toString(36).slice(2, 5).toUpperCase()
        node.textContent = `${pick(labels)} ${val} • ${(Math.random() * 0.99).toFixed(2)}`

        // Place in a safe, non-overlapping spot (avoid prose)
        // Temporarily attach for measurement
        node.style.visibility = 'hidden'
        requestAnimationFrame(() => {
          try {
            const r = node.getBoundingClientRect()
            const spot = findSpot(
              Math.max(60, r.width || 120),
              Math.max(18, r.height || 18),
              'gutters',
            )
            node.style.setProperty('--x', `${(spot.x / innerWidth) * 100}vw`)
            node.style.setProperty('--y', `${(spot.y / innerHeight) * 100}vh`)
            const len = 6 + Math.random() * 10
            node.style.setProperty('--len', `${len}vh`)
            node.style.visibility = ''
          } catch {
            node.style.visibility = ''
          }
        })
      },
      update(_t) {
        if (!node) return
        const base = /(loud|storm|studio)/.test(State.mood) ? 0.74 : 0.66
        const o = lerp(base * 0.6, base, 1 - clamp(State.readingPressure, 0, 1))
        node.style.setProperty('--o', o.toFixed(3))
        if (State.reduceMotion) return
        // very subtle glow “breath”
        if (Math.random() < 0.02) {
          node.style.filter = `drop-shadow(0 0 ${
            Math.random() < 0.5 ? 4 : 6
          }px color-mix(in oklab, currentColor 40%, transparent))`
        }
      },
      node,
    }
  }
  A.callout.meta = calloutMeta

  const graphMeta = { affinity: 'gutters', complexity: 5 }
  A.graph = () => {
    let cluster
    const nodes = []
    const edges = []

    const jitterNode = (node, scale = 1) => {
      if (!node || !node.el) return
      const amp = 22 + Math.random() * 42
      node.x = clamp(
        node.x + (Math.random() - 0.5) * amp * 0.06 * scale,
        12,
        innerWidth - 12,
      )
      node.y = clamp(
        node.y + (Math.random() - 0.5) * amp * 0.06 * scale,
        12,
        innerHeight - 12,
      )
      node.el.style.left = `${node.x}px`
      node.el.style.top = `${node.y}px`
    }

    const syncEdge = edge => {
      if (!edge || !edge.el || !edge.from || !edge.to) return
      const dx = edge.to.x - edge.from.x
      const dy = edge.to.y - edge.from.y
      const len = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      edge.el.style.left = `${edge.from.x}px`
      edge.el.style.top = `${edge.from.y}px`
      edge.el.style.width = `${Math.max(1, len)}px`
      edge.el.style.transform = `translate3d(0,0,0) rotate(${angle}deg)`
    }

    const spawnNode = () => {
      if (!cluster) return null
      const nodeEl = el('span', 'mschf-graph-node', cluster)
      const x = clamp(Math.random() * innerWidth, 24, innerWidth - 24)
      const y = clamp(Math.random() * innerHeight, 24, innerHeight - 24)
      nodeEl.style.left = `${x}px`
      nodeEl.style.top = `${y}px`
      nodeEl.dataset.variant = pick(['solid', 'ring', 'pulse'])
      nodeEl.style.setProperty('--scale', (0.85 + Math.random() * 0.5).toFixed(2))
      const node = { el: nodeEl, x, y }
      nodes.push(node)
      return node
    }

    const spawnEdge = () => {
      if (!cluster || nodes.length < 2) return null
      const edgeEl = el('i', 'mschf-graph-edge', cluster)
      const from = pick(nodes)
      let to = pick(nodes)
      if (to === from) {
        to = nodes[(nodes.indexOf(from) + 1) % nodes.length]
      }
      edgeEl.style.setProperty('--pulse', (0.4 + Math.random() * 0.5).toFixed(2))
      const edge = { el: edgeEl, from, to }
      edges.push(edge)
      syncEdge(edge)
      return edge
    }

    return {
      kind: 'graph',
      cost: 2,
      ...graphMeta,
      mount(p) {
        cluster = el('div', 'mschf-graph', p)
        const nodeCount = 4
          + Math.floor(Math.random() * (/(loud|storm)/.test(State.mood) ? 8 : 5))
        for (let i = 0; i < nodeCount; i++) spawnNode()
        const edgeCount = Math.min(nodes.length, 3 + Math.floor(Math.random() * 4))
        for (let i = 0; i < edgeCount; i++) spawnEdge()
      },
      update(t, dt = 16) {
        if (State.reduceMotion) return
        const scale = clamp(dt / 16, 0.25, 3) * (State.tempo || 1)
        for (const node of nodes) jitterNode(node, scale)
        if (Math.random() < 0.12 * State.tempo) {
          const edge = pick(edges)
          if (edge && nodes.length > 1) {
            edge.to = pick(nodes)
            if (edge.to === edge.from) {
              edge.to = nodes[(nodes.indexOf(edge.from) + 1) % nodes.length]
            }
          }
        }
        for (const edge of edges) syncEdge(edge)
      },
      node: {
        remove() {
          cluster?.remove()
          nodes.length = 0
          edges.length = 0
        },
      },
    }
  }
  A.graph.meta = graphMeta

  const ringsMeta = { affinity: 'anywhere', complexity: 2 }
  A.ringsDOM = () => {
    let node
    return {
      kind: 'rings',
      cost: 1,
      ...ringsMeta,
      mount(p) {
        node = el('div', 'mschf-rings', p)
        if (State.reduceMotion) node.classList.add('static')
        const s = 110 + Math.floor(Math.random() * 200)
        css(node, {
          left: `${10 + Math.random() * 80}%`,
          top: `${10 + Math.random() * 70}%`,
          width: s + 'px',
          height: s + 'px',
        })
      },
      node,
    }
  }
  A.ringsDOM.meta = ringsMeta
  const topoMeta = { affinity: 'anywhere', complexity: 3 }
  A.topoDOM = () => {
    let node
    return {
      kind: 'topo',
      cost: 1,
      ...topoMeta,
      mount(p) {
        node = el('div', 'mschf-topo', p)
        node.style.setProperty(
          '--rot',
          `${Math.floor((Math.random() - 0.5) * 24)}deg`,
        )
      },
      node,
    }
  }
  A.topoDOM.meta = topoMeta
  const halftoneMeta = { affinity: 'anywhere', complexity: 3 }
  A.halftone = () => {
    let node
    return {
      kind: 'halftone',
      cost: 1,
      ...halftoneMeta,
      mount(p) {
        node = el('div', 'mschf-halftone ' + pick(['tl', 'tr', 'bl', 'br']), p)
      },
      node,
    }
  }
  A.halftone.meta = halftoneMeta

  const perfMeta = { affinity: 'gutters', complexity: 2 }
  A.perf = () => {
    let node
    return {
      kind: 'perf',
      cost: 1,
      ...perfMeta,
      mount(p) {
        node = el('div', 'mschf-perf', p)
        node.dataset.side = pick(['top', 'bottom', 'left', 'right'])
      },
      node,
    }
  }
  A.perf.meta = perfMeta

  const starMeta = { affinity: 'anywhere', complexity: 4 }
  A.starfieldDOM = () => {
    let node
    return {
      kind: 'stars',
      cost: 1,
      ...starMeta,
      mount(p) {
        node = el('div', 'mschf-stars', p)
        node.style.setProperty('--density', `${0.12 + Math.random() * 0.25}`)
      },
      node,
    }
  }
  A.starfieldDOM.meta = starMeta

  // Frame & stickers
  const bracketsMeta = { affinity: 'corners', complexity: 1 }
  A.brackets = () => {
    let node
    return {
      kind: 'brackets',
      cost: 1,
      ...bracketsMeta,
      mount(p) {
        node = el('div', 'mschf-brackets', p)
        node.classList.add(pick(['tight', 'wide']))
        const isArticle = !!document.querySelector('.prose,article,main .prose')
        node.dataset.variant = State.readingPressure > 0.18 || isArticle ? 'lite' : 'bold'
        const pad = node.classList.contains('wide')
          ? 2 + Math.random() * 2
          : 5 + Math.random() * 3
        const stroke = node.dataset.variant === 'lite' ? 2 : 3
        node.style.setProperty('--pad', pad + 'vmin')
        node.style.setProperty('--b', stroke + 'px')
      },
      update() {
        if (!node) return
        const base = node.dataset.variant === 'lite' ? 0.12 : 0.18
        const o = lerp(base * 0.4, base, 1 - clamp(State.readingPressure, 0, 1))
        node.style.setProperty('--o', o.toFixed(3))
      },
      node,
    }
  }
  A.brackets.meta = bracketsMeta
  const glitchMeta = { affinity: 'gutters', complexity: 3 }
  A.glitch = () => {
    let node
    return {
      kind: 'glitch',
      cost: 1,
      ...glitchMeta,
      mount(p) {
        node = el('div', 'mschf-glitch', p)
        if (State.reduceMotion) node.classList.add('static')
        css(node, {
          top: Math.floor(Math.random() * 100) + '%',
          left: 0,
          right: 0,
        })
      },
      node,
    }
  }
  A.glitch.meta = glitchMeta
  const watermarkMeta = { affinity: 'header', complexity: 2 }
  A.watermark = () => {
    let node, inner
    const LEX = [
      'EFFUSION LABS',
      'EXPERIMENTAL',
      'INTERNAL',
      'READ ONLY',
      'NONCANON',
      'SANDBOX',
      'PROTOTYPE',
      'ARCHIVE',
    ]
    const phrase = () => `${pick(LEX)} • ${pick(LEX)} • ${pick(LEX)} •`
    return {
      kind: 'watermark',
      cost: 1,
      ...watermarkMeta,
      mount(p) {
        node = el('div', 'mschf-watermark', p)
        const isArticle = !!document.querySelector('.prose,article,main .prose')
        const variant = State.readingPressure > 0.25 || isArticle
          ? 'stripe'
          : pick(['stripe', 'full'])
        node.dataset.variant = variant
        const rot = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 10)
        const y = Math.round(8 + Math.random() * 74)
        const h = Math.round(26 + Math.random() * 28)
        node.style.setProperty('--rot', rot + 'deg')
        node.style.setProperty('--y', y + '%')
        node.style.setProperty('--h', h + 'px')
        node.style.setProperty(
          '--o',
          (/(loud|storm)/.test(State.mood) ? 0.12 : 0.08).toString(),
        )
        inner = document.createElement('span')
        inner.className = 'mschf-wm-line'
        inner.textContent = (phrase() + ' ').repeat(12)
        node.appendChild(inner)
      },
      update(t) {
        if (!node) return
        const base = parseFloat(
          getComputedStyle(node).getPropertyValue('--o') || '0.08',
        ) || 0.08
        const o = lerp(
          base * 0.35,
          base,
          1 - clamp(State.readingPressure, 0, 1),
        )
        node.style.opacity = o.toFixed(3)
        if (State.reduceMotion) return
        const dir = node.dataset.dir
          || (node.dataset.dir = Math.random() < 0.5 ? '1' : '-1')
        const speed = (State.tiers.lg ? 18 : 12)
          * (/(studio|loud)/.test(State.mood) ? 1.3 : 1.0)
        const tx = ((t / 1000) * speed * (dir === '1' ? 1 : -1)) % 100
        if (inner) inner.style.transform = `translateX(${tx.toFixed(1)}px)`
      },
      node,
    }
  }
  A.watermark.meta = watermarkMeta
  const flowersMeta = { affinity: 'anywhere', complexity: 2 }
  A.flowers = () => {
    const nodes = []
    return {
      kind: 'flowers',
      cost: 1,
      ...flowersMeta,
      mount(p) {
        const n = 1
          + Math.floor(Math.random() * (/(loud|storm)/.test(State.mood) ? 2 : 1))
        for (let i = 0; i < n; i++) {
          const fl = el('div', 'mschf-flower', p)
          const s = 34 + Math.floor(Math.random() * 26),
            x = 10 + Math.floor(Math.random() * 80),
            y = 10 + Math.floor(Math.random() * 70)
          css(fl, {
            width: s + 'px',
            height: s + 'px',
            left: x + '%',
            top: y + '%',
            transform: `rotate(${Math.floor((Math.random() - 0.5) * 160)}deg)`,
          })
          nodes.push(fl)
        }
      },
      node: {
        remove() {
          nodes.forEach(n => n.remove())
        },
      },
    }
  }
  A.flowers.meta = flowersMeta
  const holoMeta = { affinity: 'gutters', complexity: 4 }
  A.holo = () => {
    let node
    return {
      kind: 'holo',
      cost: 1,
      ...holoMeta,
      mount(p) {
        node = el('div', 'mschf-holo', p)
        if (State.reduceMotion) node.classList.add('static')
      },
      node,
    }
  }
  A.holo.meta = holoMeta
  const regMeta = { affinity: 'corners', complexity: 1 }
  A.reg = () => {
    const nodes = []
    return {
      kind: 'reg',
      cost: 1,
      ...regMeta,
      mount(p) {
        ;['tl', 'tr', 'bl', 'br'].forEach(pos => nodes.push(el('div', 'mschf-reg ' + pos, p)))
      },
      node: {
        remove() {
          nodes.forEach(n => n.remove())
        },
      },
    }
  }
  A.reg.meta = regMeta
  const dimsMeta = { affinity: 'anywhere', complexity: 1 }
  A.dims = () => {
    let node, label
    return {
      kind: 'dims',
      cost: 1,
      ...dimsMeta,
      mount(p) {
        node = el('div', 'mschf-dims', p)
        // Prefer top/bottom gutters to avoid center text
        const edgeTop = Math.random() < 0.5
        const y = edgeTop ? 8 + Math.random() * 12 : 78 + Math.random() * 12
        const x1 = 6 + Math.floor(Math.random() * 24)
        const span = 24 + Math.floor(Math.random() * 32)
        const x2 = Math.min(92, x1 + span)
        node.style.setProperty('--x1', `${x1}vw`)
        node.style.setProperty('--x2', `${x2}vw`)
        node.style.setProperty('--y', `${y}vh`)
        node.style.setProperty(
          '--o',
          (/(loud|storm)/.test(State.mood) ? 0.26 : 0.22).toString(),
        )
        label = document.createElement('em')
        label.className = 'mschf-dims-label'
        label.textContent = `${Math.abs(x2 - x1)}vw`
        node.appendChild(label)
        el('span', '', node) // right tick
      },
      update(t) {
        if (!node) return
        const base = /(studio|loud)/.test(State.mood) ? 0.22 : 0.18
        const o = lerp(base * 0.6, base, 1 - clamp(State.readingPressure, 0, 1))
        node.style.setProperty('--o', o.toFixed(3))
        if (State.reduceMotion || !label) return
        const s = 0.98 + Math.sin(t / 1200) * 0.02 // soft breathing
        label.style.setProperty('--s', s.toFixed(3))
      },
      node,
    }
  }
  A.dims.meta = dimsMeta
  const stickersMeta = { affinity: 'gutters', complexity: 3 }
  A.stickers = () => {
    let cluster
    return {
      kind: 'stickers',
      cost: 1,
      ...stickersMeta,
      mount(p) {
        cluster = el('div', 'mschf-stickers', p)
        const corner = this.corner || pick(['br', 'bl', 'tr', 'tl'])
        const off = 18 + Math.floor(Math.random() * 18)
        const s = {}
        if (corner.includes('b')) s.bottom = off + 'px'
        else s.top = off + 'px'
        if (corner.includes('r')) s.right = off + 'px'
        else s.left = off + 'px'
        css(cluster, s)
        const badges = [
          'ALPHA',
          'BETA',
          'RC1',
          'SIGNED',
          'VOID',
          'UNLOCKED',
          'PASS',
          'LAB',
          'SIM',
          'ARCHIVE',
          'SANDBOX',
          'RAG',
          'EVAL',
          'GRAPH',
          'SPARK',
          'VECTOR',
          'EMBED',
          'SPECIMEN',
          'PROTO',
        ]
        const n = 2 + Math.floor(Math.random() * 3)
        for (let i = 0; i < n; i++) {
          const b = el('span', 'mschf-badge', cluster)
          b.textContent = pick(badges)
          pick([
            () => {
              b.style.fontSize = '10px'
              b.style.padding = '5px 7px'
            },
            () => {
              b.style.fontSize = '11px'
              b.style.padding = '6px 8px'
            },
            () => {
              b.style.fontSize = '12px'
              b.style.padding = '7px 9px'
            },
          ])()
          b.style.setProperty(
            '--rx',
            `${Math.floor((Math.random() - 0.5) * 16)}deg`,
          )
          b.style.setProperty(
            '--offx',
            `${Math.floor((Math.random() - 0.5) * 14)}px`,
          )
          b.style.setProperty(
            '--offy',
            `${Math.floor((Math.random() - 0.5) * 10)}px`,
          )
          if (Math.random() < 0.22) {
            b.style.boxShadow =
              '0 0 0 1px color-mix(in oklab, currentColor 35%, transparent), 0 10px 18px rgba(0,0,0,.35)'
          }
        }
      },
      node: {
        remove() {
          cluster.remove()
        },
      },
    }
  }
  A.stickers.meta = stickersMeta

  // ————————————————————————————————————————
  // Frame Enhancements — subtle, procedural, autonomous
  // ————————————————————————————————————————
  const edgeMeta = { affinity: 'anywhere', complexity: 2 }
  A.edgeGlow = () => {
    let nodes = []
    function make(pos) {
      const n = el('div', `mschf-edge mschf-edge-${pos}`, State.domLayer)
      return n
    }
    return {
      kind: 'edgeGlow',
      cost: 1,
      ...edgeMeta,
      mount(_parent) {
        nodes = ['top', 'right', 'bottom', 'left'].map(make)
      },
      update(t) {
        const pressure = State.readingPressure || 0 // 0..1
        const base = /(loud|storm|studio)/.test(State.mood) ? 0.11 : 0.07
        const o = Math.max(0.03, base * (1 - pressure * 0.8))
        const k = (State.tempo || 1) * (State.tiers.lg ? 1 : 0.8)
        const phase = (t / 1000) * 0.2 * k // slow drift
        for (const n of nodes) {
          n.style.setProperty('--o', o.toFixed(3))
          n.style.setProperty('--p', (phase % 1).toFixed(3))
        }
      },
      node: {
        remove() {
          nodes.forEach(n => n.remove())
        },
      },
    }
  }
  A.edgeGlow.meta = edgeMeta

  const pipsMeta = { affinity: 'corners', complexity: 1 }
  A.cornerPips = () => {
    const nodes = []
    return {
      kind: 'pips',
      cost: 1,
      ...pipsMeta,
      mount(p) {
        ;['tl', 'tr', 'bl', 'br'].forEach(c => {
          const n = el('div', `mschf-pip mschf-pip-${c}`, p)
          nodes.push(n)
        })
      },
      update(t) {
        if (State.reduceMotion) return
        const beat = (Math.sin(t / 900) + 1) / 2 // 0..1
        const s = 0.9 + beat * 0.15
        for (const n of nodes) {
          n.style.transform = `scale(${s.toFixed(3)})`
        }
      },
      node: {
        remove() {
          nodes.forEach(n => n.remove())
        },
      },
    }
  }
  A.cornerPips.meta = pipsMeta

  const ACTOR_KIND_MAP = {
    grid: A.grid,
    frame: A.frame,
    corners: A.corners,
    rulers: A.rulers,
    scan: A.scanline,
    tape: A.tape,
    stamp: A.stamp,
    quotes: A.quotes,
    plate: A.plate,
    specimen: A.specimen,
    callout: A.callout,
    graph: A.graph,
    rings: A.ringsDOM,
    topo: A.topoDOM,
    halftone: A.halftone,
    perf: A.perf,
    stars: A.starfieldDOM,
    brackets: A.brackets,
    glitch: A.glitch,
    watermark: A.watermark,
    flowers: A.flowers,
    holo: A.holo,
    reg: A.reg,
    dims: A.dims,
    stickers: A.stickers,
    edgeGlow: A.edgeGlow,
    pips: A.cornerPips,
  }
  for (const [kind, factory] of Object.entries(ACTOR_KIND_MAP)) {
    if (factory) factory.kind = kind
  }

  // ————————————————————————————————————————
  // Orchestration
  // ————————————————————————————————————————
  function composeInitial() {
    DEBUG && group('composeInitial')
    C.composeInitial++
    DEBUG
      && log('style/mood/density', {
        style: State.style,
        mood: State.mood,
        density: State.density,
        tiers: { ...State.tiers },
        caps: { ...State.caps },
      })
    // Scaffold (calm by default)
    const scaffold =
      State.scene?.profile === 'essay'
        ? [A.grid, A.rulers, A.frame]
        : [A.grid, A.frame, A.corners, A.rulers]
    scaffold
      .filter(Boolean)
      .forEach(factory => {
        if (!factory) return
        if (!isKindAllowedByScene(factory.kind, 'scaffold')) return
        mount(factory(), 'scaffold')
      })

    const isArticle = !!document.querySelector('.prose,article,main .prose')

    const waves = {
      structural: () => {
        spawnLab(1, 2)
        spawnFrame(1, 2)
        if (!isArticle) spawnEphemera(1, 2)
      },
      collage: () => {
        spawnEphemera(1, 3)
        spawnLab(1, 2)
        spawnFrame(1, 2)
      },
      playful: () => {
        spawnEphemera(2, 3)
        spawnFrame(1, 2)
      },
      essay: () => {
        spawnFrame(1, 1)
        spawnEphemera(1, 2)
      },
    }
    const waveKey = State.scene?.profile === 'essay' ? 'essay' : State.style
    ;(waves[waveKey] || waves.structural)()
    const kindsSummary = fam => {
      const m = Object.create(null)
      for (const a of State.families[fam]) {
        m[a.kind || 'unknown'] = (m[a.kind || 'unknown'] || 0) + 1
      }
      return m
    }
    DEBUG
      && log('post-compose sizes', {
        scaffold: State.families.scaffold.size,
        ephemera: State.families.ephemera.size,
        lab: State.families.lab.size,
        frame: State.families.frame.size,
        nodeCount: State.nodeCount,
        kinds: {
          ephemera: kindsSummary('ephemera'),
          lab: kindsSummary('lab'),
          frame: kindsSummary('frame'),
        },
      })
    DEBUG && groupEnd()
  }

  function spawnEphemera(min, max) {
    const baseBag = [A.tape, A.stamp, A.quotes, A.plate, A.specimen]
    const bag = filterAllowedFactories(baseBag, 'ephemera')
    if (!bag.length) return
    const poolSource = State.readingPressure > 0.25
      ? bag.filter(f => (f.meta?.complexity || 1) <= 2)
      : bag
    const pool = poolSource.length ? poolSource : bag
    const n = Math.floor(lerp(min, max, State.density))
    for (let i = 0; i < n; i++) {
      const factory = pick(pool.length ? pool : bag)
      if (!factory) continue
      const actor = factory()
      if (!isKindAllowedByScene(actor.kind, 'ephemera')) continue
      mount(actor, 'ephemera')
    }
  }
  function spawnLab(min, max) {
    const gpuOK = !!State.app && !State.reduceData
    const base = [A.callout, A.graph, A.perf]
    const domExtras = [
      State.config.rings ? A.ringsDOM : null,
      State.config.topo ? A.topoDOM : null,
      A.halftone,
      A.starfieldDOM,
    ].filter(Boolean)
    const baseBag = gpuOK ? base : base.concat(domExtras)
    const bag = filterAllowedFactories(baseBag, 'lab')
    if (!bag.length) return
    const poolSource = State.readingPressure > 0.25
      ? bag.filter(f => (f.meta?.complexity || 1) <= 3)
      : bag
    const pool = poolSource.length ? poolSource : bag
    const n = Math.floor(lerp(min, max, State.density))
    for (let i = 0; i < n; i++) {
      const factory = pick(pool.length ? pool : bag)
      if (!factory) continue
      const actor = factory()
      if (!isKindAllowedByScene(actor.kind, 'lab')) continue
      mount(actor, 'lab')
    }
  }
  function spawnFrame(min, max) {
    // Calm set plus tasteful autonomous accents
    const baseBag = [
      A.brackets,
      A.watermark,
      A.reg,
      A.dims,
      A.stickers,
      A.edgeGlow,
      A.cornerPips,
    ]
    const bag = filterAllowedFactories(baseBag, 'frame')
    if (!bag.length) return
    const poolSource = State.readingPressure > 0.25
      ? bag.filter(f => (f.meta?.complexity || 1) <= 2)
      : bag
    const pool = poolSource.length ? poolSource : bag
    const n = Math.floor(lerp(min, max, State.density))
    for (let i = 0; i < n; i++) {
      const candidates = (pool.length ? pool : bag).slice()
      let placed = false
      for (let t = 0; t < candidates.length && !placed; t++) {
        const idx = Math.floor(Math.random() * candidates.length)
        const fn = candidates.splice(idx, 1)[0]
        if (!fn) continue
        const actor = fn()
        if (!isKindAllowedByScene(actor.kind, 'frame')) continue
        placed = !!mount(actor, 'frame')
      }
    }
  }

  function recompose() {
    DEBUG && group('recompose')
    C.recompose++
    resetOccupancy()
    computeContext()
    const paletteChance = State.scene?.profile === 'essay' ? 0.12 : 0.22
    if (Math.random() < paletteChance) {
      State.palette = pickPalette(State.scene?.paletteBias)
      applyPaletteTokens(State.root)
    }
    const kindsSummary = fam => {
      const m = Object.create(null)
      for (const a of State.families[fam]) {
        m[a.kind || 'unknown'] = (m[a.kind || 'unknown'] || 0) + 1
      }
      return m
    }
    const sizes = {
      ephemera: State.families.ephemera.size,
      lab: State.families.lab.size,
      frame: State.families.frame.size,
    }
    DEBUG
      && log('pre-prune sizes', {
        scaffold: State.families.scaffold.size,
        ephemera: sizes.ephemera,
        lab: sizes.lab,
        frame: sizes.frame,
        caps: { ...State.caps },
        density: State.density,
        readingPressure: State.readingPressure,
      })

    // Compute stable targets per family based on caps, density, and reading pressure.
    const d = clamp(State.density, 0.2, 0.9)
    const pressureMod = State.readingPressure > 0.25 ? 0.6 : 1.0 // quieter when reading
    const want = {
      ephemera: Math.min(
        State.caps.ephemera,
        Math.round(lerp(1, State.caps.ephemera, d) * pressureMod),
      ),
      lab: Math.min(
        State.caps.lab,
        Math.round(lerp(1, State.caps.lab, d) * pressureMod),
      ),
      frame: Math.min(
        State.caps.frame,
        Math.round(lerp(1, State.caps.frame, d) * pressureMod),
      ),
    }

    // Prefer to shed high-complexity actors when above target.
    for (const fam of ['ephemera', 'lab', 'frame']) {
      const have = sizes[fam]
      const needToRemove = Math.max(0, have - want[fam])
      if (!needToRemove) continue
      const actors = Array.from(State.families[fam]).sort(
        (a, b) => (b.complexity || 1) - (a.complexity || 1),
      )
      for (let i = 0; i < needToRemove; i++) {
        const a = actors[i]
        if (a) retire(a)
      }
      sizes[fam] -= needToRemove
    }

    // Top up gently to targets (idempotent: does nothing once at/over target)
    const addEphemera = Math.max(0, want.ephemera - sizes.ephemera)
    const addLab = Math.max(0, want.lab - sizes.lab)
    const addFrame = Math.max(0, want.frame - sizes.frame)
    if (addEphemera) spawnEphemera(addEphemera, addEphemera)
    if (addLab) spawnLab(addLab, addLab)
    if (addFrame) spawnFrame(addFrame, addFrame)

    DEBUG
      && log('post-recompose sizes', {
        scaffold: State.families.scaffold.size,
        ephemera: State.families.ephemera.size,
        lab: State.families.lab.size,
        frame: State.families.frame.size,
        nodeCount: State.nodeCount,
        kinds: {
          ephemera: kindsSummary('ephemera'),
          lab: kindsSummary('lab'),
          frame: kindsSummary('frame'),
        },
      })
    DEBUG && groupEnd()
  }

  function rareMoment() {
    if (State.scene && State.scene.allowRare === false) return
    if (State.reduceMotion || State.tiers.xs) return
    C.rare++
    DEBUG && log('rareMoment')
    mount(A.holo(), 'frame')
    for (let i = 0; i < 2; i++) mount(A.glitch(), 'frame')
    mount(A.tape(), 'ephemera')
    setTimeout(() => mount(A.tape(), 'ephemera'), 160)
  }

  function degradeDensity() {
    // drop some actors and reduce target density
    const fams = ['lab', 'frame', 'ephemera']
    State.density = Math.max(0.18, State.density - 0.06)
    for (const fam of fams) {
      const n = Math.ceil(State.families[fam].size * 0.3)
      for (let i = 0; i < n; i++) {
        const a = State.families[fam].values().next().value
        if (a) retire(a)
      }
      if (!State.fps.bad) break
    }
  }

  // ————————————————————————————————————————
  // Scheduler
  // ————————————————————————————————————————
  function tick(t) {
    if (State.paused) return
    requestAnimationFrame(tick)
    const dt = t - (State._t || t)
    State._t = t

    // FPS sentinel (sooner + gentler)
    const S = State.fps.samples
    S.push(dt)
    if (S.length > 18) S.shift()
    if (S.length === 18) {
      const avg = S.reduce((a, b) => a + b, 0) / S.length
      State.fps.bad = avg > 24 // ~ < 41 FPS
      if (State.fps.bad) degradeDensity()
    }

    if (t - State.beats.last > State.beats.dur) {
      State.beats.last = t
      C.beats++
      DEBUG
        && C.beats % 20 === 0
        && log('beat', { beats: C.beats, bars: C.bars })
    }
    if (t - State.bars.last > State.bars.dur) {
      State.bars.last = t
      C.bars++
      DEBUG
        && log('bar tick', {
          bars: C.bars,
          mood: State.mood,
          density: State.density,
          actors: State.actors.size,
        })
      const mode = State.config.recompose
      if (mode === 'auto') {
        if (Math.random() < 0.7) applyMood(nextMood(State.mood))
        recompose()
        if (State.config.rare && Math.random() < 0.06) rareMoment()
      } else if (mode === 'once') {
        if (!State._didRecompose) {
          recompose()
          State._didRecompose = true
        }
      } else {
        // 'off' → no periodic recomposition
      }
    }

    if (State._updatersDirty) {
      State._updaterList = Array.from(State.updaters)
      State._updatersDirty = false
    }
    if (State._actorsDirty) {
      State._actorList = Array.from(State.actors)
      State._actorsDirty = false
    }

    for (const a of State._updaterList) {
      if (!State.updaters.has(a)) continue
      try {
        a.update && a.update(t, dt)
      } catch {}
      if (a.dead) {
        retire(a)
        continue
      }
      if (typeof a.update !== 'function') {
        State.updaters.delete(a)
        State._updatersDirty = true
      }
    }

    // Retire any static actors flagged as dead between ticks.
    if (State._actorsDirty) {
      State._actorList = Array.from(State.actors)
      State._actorsDirty = false
    }
    for (const a of State._actorList) {
      if (!State.actors.has(a)) continue
      if (!State.updaters.has(a)) {
        if (typeof a.update === 'function') {
          State.updaters.add(a)
          State._updatersDirty = true
          continue
        }
        if (a.dead) retire(a)
      }
    }
    GPU.step(t)

    // Debug dev-labels (throttled)
    // enforce pass-through unless picking
    try {
      if (State.root) {
        State.root.style.pointerEvents = State._picking ? 'auto' : 'none'
      }
      if (State.domLayer) {
        State.domLayer.style.pointerEvents = State._picking ? 'auto' : 'none'
      }
      if (State.labelLayer) State.labelLayer.style.pointerEvents = 'none'
      if (State.app?.canvas) State.app.canvas.style.pointerEvents = 'none'
    } catch {}

    // GPU self-heal: if desired but lost/absent, try to reinit occasionally
    try {
      const wantGPU = !!(
        State.config.gpuRings
        || State.config.gpuTopo
        || State.config.gpuStars
      )
      if (wantGPU && (!State.app || State._gpuLost)) {
        const due = !State._gpuRetryAt || t > State._gpuRetryAt
        if (due) {
          State._gpuRetryAt = t + 4000 // backoff
          GPU.init().then(app => {
            if (app) {
              State._gpuLost = false
              DEBUG && log('GPU reinit ok')
            }
          })
        }
      }
    } catch {}

    if (State.debug.labelsOn) {
      try {
        updateDevLabels()
      } catch {}
    }
    if (State.debug.hudOn) {
      try {
        updateHUD()
      } catch {}
    }
  }

  // ————————————————————————————————————————
  // Observers & context
  // ————————————————————————————————————————
  function updateDevLabels() {
    if (!State.labelLayer) return
    const seen = new Set()
    for (const a of State.actors) {
      if (!a || !a.node || !a.node.getBoundingClientRect) continue
      const id = a._id
      seen.add(id)
      let lab = State._labels.get(id)
      if (!lab) {
        lab = document.createElement('div')
        lab.className = 'mschf-devlabel'
        lab.style.cssText =
          'position:fixed;z-index:999999;font:700 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;color:#00ff41;background:rgba(0,0,0,.6);border:1px solid rgba(0,255,65,.6);padding:2px 4px;border-radius:4px;pointer-events:none;user-select:none;'
        State.labelLayer.appendChild(lab)
        State._labels.set(id, lab)
      }
      const r = a.node.getBoundingClientRect()
      lab.style.left = Math.round(r.left + 2) + 'px'
      lab.style.top = Math.round(r.top + 2) + 'px'
      const txt = `#${id} ${a.kind || '?'} @${
        Object.entries(State.families).find(([, set]) => set.has(a))?.[0] || '?'
      }${a.node?.textContent?.trim() ? ` — ${a.node.textContent.trim().slice(0, 18)}` : ''}`
      lab.textContent = txt
      lab.hidden = false
    }
    // hide labels for retired actors
    for (const [id, lab] of State._labels) {
      if (!seen.has(id)) {
        try {
          lab.remove()
        } catch {}
        State._labels.delete(id)
      }
    }
  }

  // Alt-click picking without toggling pointer-events globally
  function pickFromPoint(x, y) {
    try {
      const root = State.domLayer || document
      const nodes = [...root.querySelectorAll('[data-mschf="1"]')]
      const hits = nodes.filter(n => {
        const r = n.getBoundingClientRect()
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
      })
      const target = hits[hits.length - 1] // last in DOM order ≈ on top
      if (!target) return false
      const id = +target.dataset.mschfId
      const kind = target.dataset.mschfKind
      const family = target.dataset.mschfFamily
      const r = target.getBoundingClientRect()
      const a = [...State.actors].find(x => x._id === id)
      console.log('[MSCHF] pick@point', {
        id,
        kind,
        family,
        bbox: {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
        text: (target.textContent || '').trim(),
        node: target,
        actor: a,
      })
      target.classList.add('mschf-highlight')
      setTimeout(() => target.classList.remove('mschf-highlight'), 2000)
      return true
    } catch (e) {
      DEBUG && warn('pickFromPoint error', e)
      return false
    }
  }

  function updateHUD() {
    if (!State.hud) return
    State.hud.style.display = 'block'
    const sizes = {
      scaffold: State.families.scaffold.size,
      ephemera: State.families.ephemera.size,
      lab: State.families.lab.size,
      frame: State.families.frame.size,
    }
    const line1 = `bars:${C.bars} beats:${C.beats} mood:${State.mood} d:${State.density.toFixed(2)}`
    const line2 =
      `scaf:${sizes.scaffold} eph:${sizes.ephemera} lab:${sizes.lab} frame:${sizes.frame}`
    const line3 = `actors:${State.actors.size} nodes:${State.nodeCount}`
    // brief legend of kinds by frame/ephemera
    const kinds = fam => {
      const m = Object.create(null)
      for (const a of State.families[fam]) {
        m[a.kind || '?'] = (m[a.kind || '?'] || 0) + 1
      }
      return Object.entries(m)
        .map(([k, v]) => `${k}×${v}`)
        .join(' ')
    }
    const line4 = `@ephemera ${kinds('ephemera')}`
    const line5 = `@frame ${kinds('frame')}`
    State.hud.textContent = `${line1}\n${line2}\n${line3}\n${line4}\n${line5}`
  }
  function wireSections() {
    const hero = document.querySelector(
      '.hero,[data-component~="hero"],section[id*="hero"]',
    )
    const cta = document.querySelector(
      '.map-cta,[class*="map-cta"],[data-component~="map-cta"]',
    )
    const feed = document.querySelector(
      '.work-feed,[data-component~="work-feed"]',
    )
    DEBUG && log('wireSections', { hero: !!hero, cta: !!cta, feed: !!feed })

    // Observe once per section: prevent repeated mounts when crossing thresholds
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          // Skip if we've already handled this target
          if (e.target?.dataset?.mschfSeen === '1') {
            io.unobserve(e.target)
            continue
          }
          C.io++
          DEBUG
            && log('io fired', {
              which: e.target === hero
                ? 'hero'
                : e.target === cta
                ? 'cta'
                : e.target === feed
                ? 'feed'
                : 'unknown',
              count: C.io,
            })
          if (hero && e.target === hero) {
            if (State.config.rings && isKindAllowedByScene('rings', 'lab')) {
              mount(A.ringsDOM(), 'lab')
            }
            if (isKindAllowedByScene('quotes', 'ephemera')) {
              mount(A.quotes(), 'ephemera')
            }
          }
          if (cta && e.target === cta) {
            if (isKindAllowedByScene('plate', 'ephemera')) {
              mount(A.plate(), 'ephemera')
            }
            if (State.config.rare) rareMoment()
          }
          if (feed && e.target === feed) {
            if (isKindAllowedByScene('stickers', 'frame')) {
              mount(A.stickers(), 'frame')
            }
            if (isKindAllowedByScene('dims', 'frame')) {
              mount(A.dims(), 'frame')
            }
          }

          // Mark handled and stop observing to avoid duplicate mounts
          try {
            e.target.dataset.mschfSeen = '1'
            io.unobserve(e.target)
          } catch {}
        }
      },
      { rootMargin: '0px 0px -20% 0px', threshold: [0.25, 0.6] },
    )
    ;[hero, cta, feed].filter(Boolean).forEach(n => io.observe(n))
  }

  // ————————————————————————————————————————
  // Visibility & events
  // ————————————————————————————————————————
  function onVisibility() {
    State.visible = !document.hidden
    if (!State.visible) State.paused = true
    else {
      State.paused = false
      State.beats.last = now()
      State.bars.last = now()
      DEBUG && log('visibility: resume')
      requestAnimationFrame(tick)
    }
  }

  // Auto-enable Alt-click picking in DEBUG
  const _autoPickClick = ev => {
    if (!DEBUG || !State.debug.autoPick) return
    if (!ev.altKey) return // hold Alt/Option to pick
    // don't let the page handle this click
    ev.preventDefault()
    ev.stopPropagation()
    pickFromPoint(ev.clientX, ev.clientY)
  }
  const _autoPickKey = ev => {
    if (!DEBUG || !State.debug.autoPick || !State.root) return
    if (ev.type === 'keydown' && ev.key === 'Alt') {
      State.root.style.cursor = 'crosshair'
    }
    if (ev.type === 'keyup' && ev.key === 'Alt') State.root.style.cursor = ''
  }

  // ————————————————————————————————————————
  // Boot
  // ————————————————————————————————————————
  async function boot() {
    DEBUG && log('boot()')
    mountRoot()
    computeTiers()
    computeContext()
    resetOccupancy()

    // GPU init (LG only, not reduced-data, and avoid truly weak CPUs)
    const weakCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
    if (!State.tiers.xs && !State.tiers.sm && !State.reduceData && !weakCPU) {
      State.app = await GPU.init()
    }

    // Prefer structural on obvious reading pages
    if (
      document.querySelector('.prose,article,main .prose')
      && State.style === 'collage'
    ) {
      State.style = 'structural'
    }

    applyMood(State.mood)
    composeInitial()
    wireSections()
    // In 'once' mode, schedule a single recompose shortly after initial compose
    if (State.config.recompose === 'once') {
      setTimeout(() => {
        if (!State._didRecompose) {
          try {
            recompose()
          } finally {
            State._didRecompose = true
          }
        }
      }, 600)
    }
    // Bind debug auto-pick handlers (Alt-click)
    try {
      document.addEventListener('click', _autoPickClick, true)
      document.addEventListener('keydown', _autoPickKey, true)
      document.addEventListener('keyup', _autoPickKey, true)
    } catch {}
    requestAnimationFrame(tick)
  }

  // Events
  addEventListener('resize', () => {
    computeTiers()
    computeContext()
    resetOccupancy()
  })
  document.addEventListener('visibilitychange', onVisibility, false)

  // Reduced motion/data immediate adjustments
  if (State.reduceMotion) State.density = Math.min(State.density, 0.45)
  if (State.reduceData) State.density = Math.min(State.density, 0.4)

  // Start
  if (
    document.readyState === 'complete'
    || document.readyState === 'interactive'
  ) {
    requestAnimationFrame(boot)
  } else {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(boot))
  }

  // ————————————————————————————————————————
  // Console Controls
  // ————————————————————————————————————————
  window.__mschfOff = () => {
    localStorage.setItem('mschf:off', '1')
    try {
      State.root?.remove()
    } catch {}
  }
  window.__mschfOn = () => {
    localStorage.removeItem('mschf:off')
    location.reload()
  }
  window.__mschfPulse = () => rareMoment()
  window.__mschfMood = m => {
    if (['calm', 'lite', 'bold', 'loud', 'storm', 'studio'].includes(m)) {
      applyMood(m)
    }
  }
  window.__mschfDensity = x => {
    State.density = clamp(+x || State.density, 0.1, 0.9)
    recompose()
  }
  window.__mschfPalette = name => {
    let target = null
    if (name) {
      const key = String(name).toLowerCase()
      target = HYPERBRUT_PALETTES.find(p => p.name === key) || null
    }
    State.palette = target
      ? {
        name: target.name,
        tokens: { ...(target.tokens || {}) },
        seed: Math.random().toString(16).slice(2, 6),
      }
      : pickPalette()
    if (State.root) applyPaletteTokens(State.root)
    return State.palette
  }
  window.__mschfMask = (on = 1) => {
    State.gpu.maskOn = !!+on
    GPU.updateMask()
  }
  window.__mschfAlpha = x => {
    State.alpha = clamp(+x || State.alpha, 0.3, 1.0)
    if (State.root) State.root.style.opacity = State.alpha
  }
  window.__mschfDebug = (on = 1) => {
    localStorage.setItem('mschf:debug', on ? '1' : '0')
    location.reload()
  }
  window.__mschfHUD = (on = 1) => {
    State.debug.hudOn = !!+on
    if (State.debug.hudOn) {
      updateHUD()
    } else if (State.hud) {
      State.hud.textContent = ''
      State.hud.style.display = 'none'
    }
  }
  window.__mschfAutoPick = (on = 1) => {
    State.debug.autoPick = !!+on
  }
  window.__mschfCull = (kind = 'rings') => {
    const culled = []
    for (const a of Array.from(State.actors)) {
      if ((a.kind || '') === kind) {
        retire(a)
        culled.push(a._id)
      }
    }
    console.log('[MSCHF] culled', kind, culled)
    return culled.length
  }
  window.__mschfToggle = (what, on = 1) => {
    const enable = !!+on
    if (what === 'rings') {
      State.config.rings = enable
      if (!enable) __mschfCull('rings')
      else recompose()
      return
    }
    if (what === 'topo') {
      State.config.topo = enable
      if (!enable) __mschfCull('topo')
      else recompose()
      return
    }
    if (!State.app || !GPU.stage) {
      console.warn('[MSCHF] GPU not active')
      return
    }
    const PIXI = globalThis.PIXI
    if (what === 'gpuRings') {
      State.config.gpuRings = enable
      if (enable && !GPU.rings && PIXI) {
        GPU.rings = GPU.makeRings(PIXI)
        GPU.stage.addChild(GPU.rings.container)
      }
      if (!enable && GPU.rings) {
        GPU.rings.container.removeFromParent()
        GPU.rings = null
      }
      return
    }
    if (what === 'gpuTopo') {
      State.config.gpuTopo = enable
      if (enable && !GPU.topo && PIXI) {
        GPU.topo = GPU.makeTopo(PIXI)
        GPU.stage.addChild(GPU.topo.container)
      }
      if (!enable && GPU.topo) {
        GPU.topo.container.removeFromParent()
        GPU.topo = null
      }
      return
    }
    if (what === 'gpuStars') {
      State.config.gpuStars = enable
      if (enable && !GPU.starfield && PIXI) {
        GPU.starfield = GPU.makeStars(PIXI)
        GPU.stage.addChild(GPU.starfield.container)
      }
      if (!enable && GPU.starfield) {
        GPU.starfield.container.removeFromParent()
        GPU.starfield = null
      }
      return
    }
  }
  // Turn on live dev labels: __mschfLabels(1)
  window.__mschfLabels = (on = 1) => {
    State.debug.labelsOn = !!+on
    if (on) updateDevLabels()
    else {
      for (const [, lab] of State._labels) {
        try {
          lab.remove()
        } catch {}
      }
      State._labels.clear()
    }
  }
  // Dump actors to console (optionally filter by '@family' or 'kind')
  window.__mschfDump = (filter = '') => {
    const norm = String(filter || '').trim()
    const out = []
    for (const a of State.actors) {
      const fam = Object.entries(State.families).find(([, set]) => set.has(a))?.[0] || '?'
      if (
        !norm
        || (norm.startsWith('@') && norm.slice(1) === fam)
        || (!norm.startsWith('@') && (a.kind || '') === norm)
      ) {
        const r = a.node?.getBoundingClientRect?.()
        out.push({
          id: a._id,
          kind: a.kind,
          family: fam,
          complexity: a.complexity || 1,
          text: (a.node?.textContent || '').trim().slice(0, 48),
          bbox: r
            ? {
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            }
            : null,
          node: a.node,
        })
      }
    }
    console.table(out)
    return out
  }
  // Highlight matches for a few seconds: __mschfSelect('stamp') or __mschfSelect('@frame') or __mschfSelect('*')
  window.__mschfSelect = (q = '*', seconds = 2) => {
    const root = State.domLayer || document
    let sel = []
    if (q === '*') sel = [...root.querySelectorAll('[data-mschf="1"]')]
    else if (q.startsWith('@')) {
      sel = [...root.querySelectorAll(`[data-mschf-family="${q.slice(1)}"]`)]
    } else sel = [...root.querySelectorAll(`[data-mschf-kind="${q}"]`)]
    sel.forEach(n => n.classList.add('mschf-highlight'))
    setTimeout(
      () => sel.forEach(n => n.classList.remove('mschf-highlight')),
      seconds * 1000,
    )
    return sel.length
  }
  // Find overlay nodes containing text (e.g., 'READ ONLY') and highlight
  window.__mschfFind = (text, seconds = 3) => {
    const t = String(text || '').toLowerCase()
    if (!t) return 0
    const nodes = [
      ...(State.domLayer || document).querySelectorAll('[data-mschf="1"]'),
    ].filter(n => (n.textContent || '').toLowerCase().includes(t))
    nodes.forEach(n => n.classList.add('mschf-highlight'))
    setTimeout(
      () => nodes.forEach(n => n.classList.remove('mschf-highlight')),
      seconds * 1000,
    )
    console.log('[MSCHF] __mschfFind', t, nodes)
    return nodes.length
  }
  // Click-to-inspect overlay: __mschfPick(1) then click a visual
  window.__mschfPick = (on = 1, timeoutMs = 5000) => {
    const enable = !!+on
    const layer = State.domLayer
    if (!layer) return false
    State._picking = enable
    layer.style.cursor = enable ? 'crosshair' : ''
    const handler = ev => {
      const target = ev.target.closest('[data-mschf="1"]')
      if (!target) return
      ev.preventDefault()
      ev.stopPropagation()
      const id = +target.dataset.mschfId
      const a = [...State.actors].find(x => x._id === id)
      const fam = Object.entries(State.families).find(([, set]) => set.has(a))?.[0] || '?'
      const r = target.getBoundingClientRect()
      console.log('[MSCHF] pick', {
        id: a?._id,
        kind: a?.kind,
        family: fam,
        text: (target.textContent || '').trim(),
        bbox: {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
        node: target,
        actor: a,
      })
      target.classList.add('mschf-highlight')
      setTimeout(() => target.classList.remove('mschf-highlight'), 2000)
      // auto-exit after one pick
      if (State._picking) {
        State._picking = false
        layer.style.cursor = ''
      }
    }
    if (enable) {
      layer.addEventListener('click', handler, {
        capture: true,
        passive: false,
      })
      State._pickHandler = handler
      if (timeoutMs > 0) {
        setTimeout(() => {
          if (State._picking) {
            State._picking = false
            layer.style.cursor = ''
          }
        }, timeoutMs)
      }
    } else if (State._pickHandler) {
      layer.removeEventListener('click', State._pickHandler, { capture: true })
      State._pickHandler = null
    }
    return enable
  }
  window.__mschfRecompose = (mode = 'auto') => {
    State.config.recompose = String(mode).toLowerCase()
  }
  window.__mschfRare = (on = 1) => {
    State.config.rare = !!+on
  }
  window.__mschfStats = () => ({
    counters: { ...C },
    sizes: {
      scaffold: State.families.scaffold.size,
      ephemera: State.families.ephemera.size,
      lab: State.families.lab.size,
      frame: State.families.frame.size,
    },
    nodeBudget: State.nodeBudget,
    nodeCount: State.nodeCount,
    caps: { ...State.caps },
    density: State.density,
    readingPressure: State.readingPressure,
    mood: State.mood,
    visible: State.visible,
  })
})()
