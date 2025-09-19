// public/js/theme-utils.js
// Framework-agnostic theme helpers for DaisyUI v5 themes.
// Exposes a tiny global `ThemeUtils` for non-module usage and works without bundlers.
;(function(global) {
  'use strict'

  var STORAGE_KEY = 'theme'
  var THEMES = { light: 'silk', dark: 'dim' }
  var LIGHT_NAME = THEMES.light
  var DARK_NAME = THEMES.dark
  var DEFAULT = DARK_NAME
  var ALLOWED = [LIGHT_NAME, DARK_NAME]

  function normalize(name) {
    if (!name) return name
    if (name === 'light') return LIGHT_NAME
    if (name === 'dark') return DARK_NAME
    return name
  }

  function syncAllowed(list) {
    var merged = Array.isArray(list) && list.length ? list.slice() : ALLOWED.slice()
    merged.push(LIGHT_NAME, DARK_NAME)
    ALLOWED = Array.from(
      new Set(
        merged
          .map(function(value) {
            return normalize(String(value))
          })
          .filter(Boolean),
      ),
    )
  }

  syncAllowed()

  function configure(opts) {
    try {
      if (!opts || typeof opts !== 'object') return
      if (opts.lightTheme && typeof opts.lightTheme === 'string') {
        LIGHT_NAME = normalize(opts.lightTheme)
      }
      if (opts.darkTheme && typeof opts.darkTheme === 'string') {
        DARK_NAME = normalize(opts.darkTheme)
      }
      if (opts.defaultTheme && typeof opts.defaultTheme === 'string') {
        DEFAULT = normalize(opts.defaultTheme)
      } else {
        DEFAULT = normalize(DEFAULT)
      }
      THEMES.light = LIGHT_NAME
      THEMES.dark = DARK_NAME
      if (Array.isArray(opts.allowed) && opts.allowed.length) {
        syncAllowed(opts.allowed)
      } else {
        syncAllowed()
      }
      if (opts.storageKey && typeof opts.storageKey === 'string') {
        STORAGE_KEY = opts.storageKey
      }
    } catch (_) {
      /* noop */
    }
  }

  function getTheme() {
    var el = document.documentElement
    var t = normalize(el.getAttribute('data-theme'))
    if (!t || ALLOWED.indexOf(t) === -1) {
      // Fallback to storage then default
      try {
        var s = normalize(localStorage.getItem(STORAGE_KEY))
        if (s && ALLOWED.indexOf(s) !== -1) t = s
      } catch (_) {}
    }
    return ALLOWED.indexOf(t) !== -1 ? t : DEFAULT
  }

  function setTheme(name, persist, source) {
    var target = normalize(name)
    if (ALLOWED.indexOf(target) === -1) return
    var el = document.documentElement
    el.setAttribute('data-theme', target)
    el.dataset.themeSource = source || 'user'
    var meta = document.querySelector('meta[name="color-scheme"]')
    if (meta) {
      var isDark = target === DARK_NAME
      meta.setAttribute('content', isDark ? 'dark light' : 'light dark')
    }
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, target)
      } catch (_) {}
    }
    try {
      document.dispatchEvent(
        new CustomEvent('themechange', {
          detail: { theme: target, source: source || 'user' },
        }),
      )
    } catch (_) {}
  }

  function toggleTheme(persist) {
    var cur = getTheme()
    // Prefer binary toggle between LIGHT_NAME and DARK_NAME
    var next = cur === DARK_NAME ? LIGHT_NAME : DARK_NAME
    setTheme(next, persist !== false, 'toggle')
    return next
  }

  function initEarly() {
    // Run as early as possible in <head> to avoid FART.
    try {
      var stored = normalize(localStorage.getItem(STORAGE_KEY))
      var picked = ALLOWED.indexOf(stored) !== -1 ? stored : DEFAULT
      document.documentElement.setAttribute('data-theme', picked)
      document.documentElement.dataset.themeSource = stored
        ? 'storage'
        : 'default'
      var meta = document.querySelector('meta[name="color-scheme"]')
        || (function() {
          var m = document.createElement('meta')
          m.name = 'color-scheme'
          document.head.appendChild(m)
          return m
        })()
      meta.content = picked === DARK_NAME ? 'dark light' : 'light dark'
    } catch (_) {
      document.documentElement.setAttribute('data-theme', DEFAULT)
      document.documentElement.dataset.themeSource = 'fallback'
    }
  }

  function onChange(handler) {
    if (typeof handler !== 'function') return function() {}
    var fn = function(e) {
      handler(e?.detail?.theme || getTheme(), e?.detail?.source || 'event')
    }
    document.addEventListener('themechange', fn)
    return function unsubscribe() {
      document.removeEventListener('themechange', fn)
    }
  }

  var api = {
    configure: configure,
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    initEarly: initEarly,
    onChange: onChange,
    THEMES: THEMES,
  }
  global.ThemeUtils = api
})(window)
