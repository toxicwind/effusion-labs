// import '/assets/css/app.css'

// public/js/app.js
// Vite entry: imports CSS and initializes all page-level JS.
// Consolidates: footnote nav, theme toggle, code copy, work filters.
// Lazily loads the heavy overlay only when conditions are good.

/* -------------------------------
   tiny utils
--------------------------------*/
export const onReady = cb => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cb, { once: true })
  } else {
    cb()
  }
}
const qs = (sel, root = document) => root.querySelector(sel)
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel))
const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
const saveData = () => {
  try {
    const c = navigator.connection
    return !!(c && (c.saveData || /2g/.test(c.effectiveType || '')))
  } catch {
    return false
  }
}

/* -------------------------------
   1) Footnote navigation
   (sticky header aware + highlight)
--------------------------------*/
export function initFootnotes() {
  const EXTRA = 16

  const getHeaderEl = () =>
    qs('[data-site-header]')
    || qs('[role="banner"]')
    || qs('header.site-header')
    || qs('body > header')
    || qs('header')

  const readCssVar = () =>
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--header-height',
      ),
    ) || null

  const calcHeaderHeight = () => {
    const fromVar = readCssVar()
    if (Number.isFinite(fromVar)) return Math.ceil(fromVar)
    const h = getHeaderEl()
    if (!h) return 80 + EXTRA
    const r = h.getBoundingClientRect()
    return Math.ceil(r.height) + EXTRA
  }

  const setVar = px => document.documentElement.style.setProperty('--header-height', `${px}px`)

  const updateHeaderVar = () => setVar(calcHeaderHeight())

  // keep var fresh
  let resizeRaf = 0
  const onResize = () => {
    if (resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      updateHeaderVar()
    })
  }
  const h = getHeaderEl()
  if ('ResizeObserver' in window && h) {
    new ResizeObserver(updateHeaderVar).observe(h)
  }
  window.addEventListener('resize', onResize, { passive: true })
  updateHeaderVar()

  const isFnHash = (href = '') => /^#fn(ref)?/i.test(href)

  const applyHighlight = el => {
    if (!el) return
    const hadTabindex = el.hasAttribute('tabindex')
    const prev = el.getAttribute('tabindex')
    if (!hadTabindex) el.setAttribute('tabindex', '-1')
    el.classList.add('footnote-highlight')
    el.focus({ preventScroll: true })
    setTimeout(() => {
      el.classList.remove('footnote-highlight')
      if (!hadTabindex) el.removeAttribute('tabindex')
      else if (prev !== null) el.setAttribute('tabindex', prev)
    }, 2200)
  }

  const smoothScrollTo = (target, { skipHistory } = {}) => {
    if (!target) return
    const header = calcHeaderHeight()
    const rect = target.getBoundingClientRect()
    const top = Math.max(0, window.pageYOffset + rect.top - header)
    window.scrollTo({
      top,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
    if (!skipHistory) {
      const id = target.id ? `#${target.id}` : ''
      if (id && id !== location.hash) {
        try {
          history.pushState(null, '', id)
        } catch {}
      }
    }
    applyHighlight(target)
  }

  document.addEventListener(
    'click',
    e => {
      const a = e.target.closest('a[href^="#"]')
      if (!a) return
      const href = a.getAttribute('href')
      if (!isFnHash(href)) return
      const target = qs(href)
      if (!target) return
      e.preventDefault()
      smoothScrollTo(target)
    },
    false,
  )

  const handleInitial = () => {
    const { hash } = window.location
    if (!isFnHash(hash)) return
    const t = qs(hash)
    if (!t) return
    setTimeout(() => smoothScrollTo(t, { skipHistory: true }), 50)
  }

  window.addEventListener('popstate', handleInitial, false)
  handleInitial()
}

/* -------------------------------
   2) Theme toggle button
   (uses global ThemeUtils from head)
--------------------------------*/
export function initThemeToggle() {
  const btn = qs('#theme-toggle')
  if (!btn) return

  const utils = window.ThemeUtils || null
  const sun = btn.querySelector('.lucide-sun')
  const moon = btn.querySelector('.lucide-moon')

  const reflect = theme => {
    const dark = utils ? utils.THEMES.dark : 'dim'
    const isDark = theme === dark
    btn.setAttribute('aria-pressed', String(isDark))
    btn.setAttribute(
      'aria-label',
      isDark ? 'Switch to light theme' : 'Switch to dark theme',
    )
    if (sun && moon) {
      sun.classList.toggle('hidden', isDark)
      moon.classList.toggle('hidden', !isDark)
    }
  }

  reflect(
    (utils && utils.getTheme())
      || document.documentElement.getAttribute('data-theme')
      || 'dim',
  )

  if (utils) {
    btn.addEventListener('click', () => reflect(utils.toggleTheme(true)))
    utils.onChange(reflect)
  } else {
    // Fallback (shouldn’t happen)
    btn.addEventListener('click', () => {
      const el = document.documentElement
      const cur = el.getAttribute('data-theme') || 'dim'
      const next = cur === 'dim' ? 'silk' : 'dim'
      el.setAttribute('data-theme', next)
      reflect(next)
    })
  }
}

/* -------------------------------
   3) Code copy buttons
--------------------------------*/
export function initCodeCopy() {
  const blocks = qsa('pre > code')
  if (!blocks.length) return
  for (const code of blocks) {
    const pre = code.parentElement
    if (!pre || pre.querySelector('button[data-copy]')) continue
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.copy = ''
    btn.className = 'btn btn-xs btn-ghost hb-anim'
    btn.textContent = 'copy'
    btn.style.marginBottom = '0.5rem'
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || '')
        const prev = btn.textContent
        btn.textContent = 'copied'
        setTimeout(() => (btn.textContent = prev), 1500)
      } catch {}
    })
    pre.insertBefore(btn, code)
  }
}

/* -------------------------------
   4) Work filters
--------------------------------*/
export function initWorkFilters() {
  const buttons = qsa('[data-filter]')
  const items = qsa('#work-list > li')
  if (!buttons.length || !items.length) return

  const apply = filter => {
    for (const li of items) {
      const type = li.dataset.type
      li.classList.toggle('hidden', filter !== 'all' && type !== filter)
    }
  }

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      for (const b of buttons) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false')
      }
      apply(btn.dataset.filter || 'all')
    })
  }
}

/* -------------------------------
   5) Lazy overlay loader
   (only when it won’t hurt UX)
--------------------------------*/
export function initOverlayLoader() {
  const body = document.body || document.documentElement
  const overlayOff = body?.dataset?.mschf === 'off' || localStorage.getItem('mschf:off') === '1'
  const forceOn = new URLSearchParams(location.search).get('overlay') === '1'
    || body?.dataset?.overlay === '1'
  const isLg = window.matchMedia?.('(min-width: 1024px)')?.matches ?? false

  // Conditions: not disabled, large screens, no save-data, no reduced motion
  const shouldLoad = !overlayOff && (forceOn || (isLg && !saveData() && !prefersReducedMotion()))

  if (!shouldLoad) return

  const doImport = () => import('./mschf-overlay.js').catch(() => {})
  if ('requestIdleCallback' in window) {
    // Give main content time to settle
    requestIdleCallback(() => doImport(), { timeout: 2000 })
  } else {
    setTimeout(doImport, 600)
  }
}

/* -------------------------------
   bootstrap helpers
--------------------------------*/
export function bootSite() {
  initFootnotes()
  initThemeToggle()
  initCodeCopy()
  initWorkFilters()
  initOverlayLoader()
}
