/**
 * @license Effusion Labs — Hypebrüt Overlay (Balanced Edition)
 *
 * A refactored version balancing aesthetics and performance. It restores some of
 * the original's visual flair while keeping the core optimizations that prevent lag.
 *
 * Key Features:
 * - A single, curated scene that composes on load. No expensive recomposition.
 * - Re-introduction of key visual elements like corner markers.
 * - Enhanced styling for a richer, more atmospheric look.
 * - A lightweight rendering loop that avoids animation lag.
 * - Layout analysis runs only once at boot to prevent performance issues.
 *
 * @version 3.1 (Balanced)
 * @author Effusion Labs (Refactored for Performance & Aesthetics)
 */
;(() => {
  // =================================================================
  // I. BOOT GUARD & INITIALIZATION
  // =================================================================

  if (window.__mschfBooted) return
  window.__mschfBooted = true

  const scope = document.body || document.documentElement
  if (!scope || scope.dataset.mschf === 'off' || localStorage.getItem('mschf:off') === '1') {
    return
  }

  // =================================================================
  // II. CORE UTILITIES & HELPERS
  // =================================================================

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const pick = arr => arr[Math.floor(Math.random() * arr.length)]
  const css = (el, obj) => {
    for (const k in obj) el.style[k] = obj[k]
    return el
  }
  const el = (tag, cls, parent) => {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    ;(parent || document.body).appendChild(n)
    n.style.pointerEvents = 'none'
    n.style.userSelect = 'none'
    // Add debug attributes
    if (State._mountCtx) {
      n.dataset.mschf = '1'
      n.dataset.mschfKind = State._mountCtx.kind || 'unknown'
      n.dataset.mschfFamily = State._mountCtx.family || 'unknown'
    }
    return n
  }

  // =================================================================
  // III. ENVIRONMENT & PERFORMANCE DETECTION
  // =================================================================

  const viewportMetrics = () => {
    const width = Math.max(1, window.innerWidth || 1024)
    const height = Math.max(1, window.innerHeight || 768)
    const area = width * height
    const pixelRatio = window.devicePixelRatio || 1
    const hiDensity = pixelRatio >= 1.5
    const xl = width >= 1440 || area >= 3_200_000
    const uhd = width >= 2200 || area >= 5_000_000
    return { width, height, degrade: uhd || (hiDensity && xl) }
  }

  const PERF_BASELINE = viewportMetrics()

  // =================================================================
  // IV. PALETTE MANAGEMENT
  // =================================================================

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
  ]

  const pickPalette = () => {
    const base = { ...pick(HYPERBRUT_PALETTES) }
    const tokens = { ...(base.tokens || {}) }
    if (Math.random() < 0.35) [tokens.pop, tokens['pop-alt']] = [tokens['pop-alt'], tokens.pop]
    return { name: base.name, tokens, seed: Math.random().toString(16).slice(2, 6) }
  }

  const applyPaletteTokens = root => {
    if (!root || !State.palette) return
    root.dataset.mschfPalette = State.palette.name || ''
    for (const [key, value] of Object.entries(State.palette.tokens || {})) {
      root.style.setProperty(`--mschf-${key}`, value)
    }
  }

  // =================================================================
  // V. GLOBAL STATE (SIMPLIFIED)
  // =================================================================

  const State = {
    root: null,
    domLayer: null,
    palette: pickPalette(),
    nodeBudget: PERF_BASELINE.degrade ? 50 : 80, // Increased budget slightly
    nodeCount: 0,
    actors: new Set(),
    updaters: new Set(),
    _updaterList: [],
    families: { scaffold: new Set(), ephemera: new Set(), frame: new Set() },
    safeZones: [],
    actorBoxes: new Map(),
    gridCols: 10,
    gridRows: 6,
    paused: false,
    _mountCtx: null, // For debug tagging during actor creation
    readingPressure: 0,
  }

  // =================================================================
  // VI. ROOT & LAYER MOUNTING
  // =================================================================

  function mountRoot() {
    let root = document.getElementById('mschf-overlay-root')
    if (!root) {
      root = el('div', '', document.body)
      root.id = 'mschf-overlay-root'
    }
    css(root, {
      pointerEvents: 'none',
      userSelect: 'none',
      position: 'fixed',
      inset: '0',
      zIndex: '44',
      contain: 'layout style paint',
      opacity: '0.9',
    })
    root.setAttribute('aria-hidden', 'true')
    root.innerHTML = ''

    State.root = root
    State.domLayer = el('div', 'mschf-layer', root)
    css(State.domLayer, {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      userSelect: 'none',
    })

    applyPaletteTokens(State.root)
  }

  // =================================================================
  // VII. PAGE CONTEXT & LAYOUT ANALYSIS (RUNS ONCE)
  // =================================================================

  function analyzePageLayout() {
    const selector = '.prose, main, article, header, nav, [data-safe]'
    const pad = 24
    const rects = []
    document.querySelectorAll(selector).forEach(node => {
      const r = node.getBoundingClientRect()
      if (r && r.width > 0 && r.height > 0) {
        rects.push({
          x: clamp(r.left - pad, 0, innerWidth),
          y: clamp(r.top - pad, 0, innerHeight),
          w: clamp(r.width + pad * 2, 0, innerWidth),
          h: clamp(r.height + pad * 2, 0, innerHeight),
        })
      }
    })
    State.safeZones = rects

    const pCount = document.querySelectorAll('p, li, blockquote').length
    State.readingPressure = clamp(pCount / 100, 0, 1)
  }

  // =================================================================
  // VIII. PLACEMENT & COLLISION
  // =================================================================

  const rectOverlap = (a, b) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

  const collides = r => {
    const area = Math.max(1, r.w * r.h)
    for (const z of State.safeZones) if (rectOverlap(r, z) / area > 0.05) return true
    for (const [, z] of State.actorBoxes) if (rectOverlap(r, z) / area > 0.1) return true
    return false
  }

  function findSpot(w, h) {
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * (innerWidth - w)
      const y = Math.random() * (innerHeight - h)
      const rect = { x, y, w, h }
      if (!collides(rect)) {
        return rect
      }
    }
    return { x: Math.random() * (innerWidth - w), y: Math.random() * (innerHeight - h), w, h }
  }

  // =================================================================
  // IX. ACTOR FRAMEWORK
  // =================================================================

  function mount(actor, family) {
    if (!actor || (State.nodeCount + (actor.cost || 1) > State.nodeBudget)) {
      return false
    }

    State._mountCtx = { kind: actor.kind, family }
    State.families[family].add(actor)
    State.actors.add(actor)
    State.nodeCount += actor.cost || 1

    try {
      actor.mount(State.domLayer)
    } catch {
      State.families[family].delete(actor)
      State.actors.delete(actor)
      State.nodeCount = Math.max(0, State.nodeCount - (actor.cost || 1))
      return false
    }

    if (typeof actor.update === 'function') {
      State.updaters.add(actor)
    }

    const r = actor.node?.getBoundingClientRect?.()
    if (r?.width > 0) {
      State.actorBoxes.set(actor, { x: r.left, y: r.top, w: r.width, h: r.height })
    }

    State._mountCtx = null
    return true
  }

  const A = {} // Actor Factory

  // --- SCAFFOLD ACTORS ---
  A.grid = () => ({
    kind: 'grid',
    cost: 1,
    mount(p) {
      this.node = el('div', 'mschf-grid', p)
      this.node.dataset.variant = pick(['dots', 'lines'])
    },
  })
  A.rulers = () => ({
    kind: 'rulers',
    cost: 1,
    mount(p) {
      const top = el('div', 'mschf-ruler mschf-ruler-top', p)
      const left = el('div', 'mschf-ruler mschf-ruler-left', p)
      this.node = {
        remove: () => {
          top.remove()
          left.remove()
        },
      }
    },
  })
  A.corners = () => ({
    kind: 'corners',
    cost: 1,
    mount(p) {
      const nodes = ['tl', 'tr', 'bl', 'br'].map(pos =>
        el('div', `mschf-corner mschf-corner-${pos}`, p)
      )
      this.node = { remove: () => nodes.forEach(n => n.remove()) }
    },
  })

  // --- EPHEMERA ACTORS ---
  A.plate = () => ({
    kind: 'plate',
    cost: 1,
    mount(p) {
      this.node = el('div', 'mschf-plate', p)
      el('div', 'mschf-barcode', this.node)
      const code = el('div', 'mschf-code', this.node)
      code.textContent = `SEED:${Math.random().toString(16).slice(-6).toUpperCase()}`
      const spot = findSpot(180, 40)
      css(this.node, { left: `${spot.x}px`, top: `${spot.y}px` })
    },
  })
  A.specimen = () => ({
    kind: 'specimen',
    cost: 1,
    mount(p) {
      this.node = el('div', 'mschf-specimen', p)
      const id = Math.random().toString(36).slice(2, 7).toUpperCase()
      this.node.innerHTML = `<strong>SPECIMEN</strong><span>ID ${id}</span><span>${
        new Date().toISOString().slice(0, 10)
      }</span>`
      const side = Math.random() < 0.5 ? 'right' : 'left'
      const s = { top: `${16 + Math.random() * 20}px` }
      s[side] = `${18 + Math.random() * 24}px`
      css(this.node, s)
    },
  })

  // --- FRAME ACTORS ---
  A.brackets = () => ({
    kind: 'brackets',
    cost: 1,
    mount(p) {
      this.node = el('div', 'mschf-brackets', p)
      this.node.dataset.variant = State.readingPressure > 0.3 ? 'lite' : 'bold'
      const pad = 3 + Math.random() * 3
      this.node.style.setProperty('--pad', `${pad}vmin`)
      this.node.style.setProperty('--b', (this.node.dataset.variant === 'lite' ? 2 : 3) + 'px')
    },
  })
  A.dims = () => ({
    kind: 'dims',
    cost: 1,
    mount(p) {
      this.node = el('div', 'mschf-dims', p)
      const y = Math.random() < 0.5 ? 8 + Math.random() * 12 : 78 + Math.random() * 12
      const x1 = 6 + Math.floor(Math.random() * 24)
      const span = 24 + Math.floor(Math.random() * 32)
      const x2 = Math.min(92, x1 + span)
      this.node.style.setProperty('--x1', `${x1}vw`)
      this.node.style.setProperty('--x2', `${x2}vw`)
      this.node.style.setProperty('--y', `${y}vh`)
      const label = el('em', 'mschf-dims-label', this.node)
      label.textContent = `${x2 - x1}vw`
      el('span', '', this.node) // tick
    },
  })
  A.edgeGlow = () => ({
    kind: 'edgeGlow',
    cost: 1,
    mount(p) {
      this.nodes = ['top', 'right', 'bottom', 'left'].map(pos =>
        el('div', `mschf-edge mschf-edge-${pos}`, p)
      )
      this.node = { remove: () => this.nodes.forEach(n => n.remove()) }
    },
    update(t) {
      const o = Math.max(0.03, 0.07 * (1 - State.readingPressure * 0.8))
      const phase = (t / 1000 * 0.2) % 1
      for (const n of this.nodes) {
        n.style.setProperty('--o', o.toFixed(3))
        n.style.setProperty('--p', phase.toFixed(3))
      }
    },
  })

  // =================================================================
  // X. ORCHESTRATION (BALANCED)
  // =================================================================

  function composeScene() {
    // 1. Scaffold (Base layer)
    mount(A.grid(), 'scaffold')
    mount(A.rulers(), 'scaffold')
    mount(A.corners(), 'scaffold') // <-- Re-introduced
    mount(A.edgeGlow(), 'scaffold')

    // 2. Frame (Structural elements)
    const frameActors = [A.brackets, A.dims]
    for (let i = 0; i < 2; i++) {
      mount(pick(frameActors)(), 'frame')
    }

    // 3. Ephemera (Content-like details, placed safely)
    const ephemeraActors = [A.plate, A.specimen]
    const count = PERF_BASELINE.degrade ? 1 : 2 // Less ephemera on demanding displays
    for (let i = 0; i < count; i++) {
      if (Math.random() > State.readingPressure) {
        mount(pick(ephemeraActors)(), 'ephemera')
      }
    }
  }

  // =================================================================
  // XI. MAIN LOOP (OPTIMIZED)
  // =================================================================

  function tick(t) {
    if (State.paused) return
    requestAnimationFrame(tick)

    for (const a of State._updaterList) {
      a.update(t)
    }
  }

  // =================================================================
  // XII. BOOTSTRAP
  // =================================================================

  function boot() {
    mountRoot()
    analyzePageLayout()
    composeScene()

    State._updaterList = Array.from(State.updaters)

    requestAnimationFrame(tick)
  }

  document.addEventListener('visibilitychange', () => {
    State.paused = document.hidden
    if (!State.paused) requestAnimationFrame(tick)
  }, false)

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot()
  } else {
    document.addEventListener('DOMContentLoaded', boot)
  }

  window.__mschfOff = () => {
    localStorage.setItem('mschf:off', '1')
    State.root?.remove()
  }
  window.__mschfOn = () => {
    localStorage.removeItem('mschf:off')
    location.reload()
  }
})()
