// src/assets/js/theme-utils.js
// Framework-agnostic theme helpers for DaisyUI v5 themes.
// Exposes a tiny global `ThemeUtils` for non-module usage and works without bundlers.
(function (global) {
  "use strict";

  var STORAGE_KEY = "theme";
  var THEMES = { light: "light", dark: "dark" };
  var DEFAULT = THEMES.light;
  var DARK_NAME = THEMES.dark;
  var ALLOWED = [THEMES.light, THEMES.dark];

  function configure(opts) {
    try {
      if (!opts || typeof opts !== "object") return;
      if (Array.isArray(opts.allowed) && opts.allowed.length) {
        ALLOWED = opts.allowed.map(String);
      }
      if (opts.defaultTheme && typeof opts.defaultTheme === "string") {
        DEFAULT = opts.defaultTheme;
      }
      if (opts.darkTheme && typeof opts.darkTheme === "string") {
        DARK_NAME = opts.darkTheme;
      }
      if (opts.storageKey && typeof opts.storageKey === "string") {
        STORAGE_KEY = opts.storageKey;
      }
    } catch (_) { /* noop */ }
  }

  function getTheme() {
    var el = document.documentElement;
    var t = el.getAttribute("data-theme");
    if (!t || ALLOWED.indexOf(t) === -1) {
      // Fallback to storage then default
      try {
        var s = localStorage.getItem(STORAGE_KEY);
        if (s && ALLOWED.indexOf(s) !== -1) t = s;
      } catch (_) {}
    }
    return ALLOWED.indexOf(t) !== -1 ? t : DEFAULT;
  }

  function setTheme(name, persist, source) {
    if (ALLOWED.indexOf(name) === -1) return;
    var el = document.documentElement;
    el.setAttribute("data-theme", name);
    el.dataset.themeSource = source || "user";
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", name === DEFAULT ? "light dark" : "dark light");
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, name); } catch (_) {}
    }
    try { document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: name, source: source || "user" } })); } catch (_) {}
  }

  function toggleTheme(persist) {
    var cur = getTheme();
    // Prefer binary toggle between DEFAULT and DARK_NAME
    var next = cur === DARK_NAME ? DEFAULT : DARK_NAME;
    setTheme(next, persist !== false, "toggle");
    return next;
  }

  function initEarly() {
    // Run as early as possible in <head> to avoid FART.
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      var picked = (stored && ALLOWED.indexOf(stored) !== -1)
        ? stored
        : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK_NAME : DEFAULT);
      document.documentElement.setAttribute("data-theme", picked);
      document.documentElement.dataset.themeSource = stored ? "storage" : "default";
      var meta = document.querySelector('meta[name="color-scheme"]') || (function (){ var m=document.createElement("meta"); m.name = "color-scheme"; document.head.appendChild(m); return m; })();
      meta.content = (picked === DEFAULT) ? "light dark" : "dark light";
    } catch (_) {
      document.documentElement.setAttribute("data-theme", DEFAULT);
      document.documentElement.dataset.themeSource = "fallback";
    }
  }

  function onChange(handler) {
    if (typeof handler !== "function") return function () {};
    var fn = function (e) { handler(e?.detail?.theme || getTheme(), e?.detail?.source || "event"); };
    document.addEventListener("themechange", fn);
    return function unsubscribe() { document.removeEventListener("themechange", fn); };
  }

  var api = { configure: configure, getTheme: getTheme, setTheme: setTheme, toggleTheme: toggleTheme, initEarly: initEarly, onChange: onChange, THEMES: THEMES };
  global.ThemeUtils = api;
})(window);
