// src/scripts/theme-utils.js
// Framework-agnostic theme helpers for DaisyUI v5 themes.
// Exposes a tiny global `ThemeUtils` for non-module usage and works without bundlers.
(function (global) {
  "use strict";

  var STORAGE_KEY = "theme";
  var THEMES = { light: "corporate", dark: "dim" };
  var ALLOWED = [THEMES.light, THEMES.dark];

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
    return ALLOWED.indexOf(t) !== -1 ? t : THEMES.dark;
  }

  function setTheme(name, persist, source) {
    if (ALLOWED.indexOf(name) === -1) return;
    var el = document.documentElement;
    el.setAttribute("data-theme", name);
    el.dataset.themeSource = source || "user";
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", name === THEMES.light ? "light dark" : "dark light");
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, name); } catch (_) {}
    }
    try { document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: name, source: source || "user" } })); } catch (_) {}
  }

  function toggleTheme(persist) {
    var next = getTheme() === THEMES.dark ? THEMES.light : THEMES.dark;
    setTheme(next, persist !== false, "toggle");
    return next;
  }

  function initEarly() {
    // Run as early as possible in <head> to avoid FART.
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      var picked = (stored && ALLOWED.indexOf(stored) !== -1) ? stored : THEMES.dark; // default dark
      document.documentElement.setAttribute("data-theme", picked);
      document.documentElement.dataset.themeSource = stored ? "storage" : "default";
      var meta = document.querySelector('meta[name="color-scheme"]') || (function (){ var m=document.createElement("meta"); m.name = "color-scheme"; document.head.appendChild(m); return m; })();
      meta.content = (picked === THEMES.light) ? "light dark" : "dark light";
    } catch (_) {
      document.documentElement.setAttribute("data-theme", THEMES.dark);
      document.documentElement.dataset.themeSource = "fallback";
    }
  }

  function onChange(handler) {
    if (typeof handler !== "function") return function () {};
    var fn = function (e) { handler(e?.detail?.theme || getTheme(), e?.detail?.source || "event"); };
    document.addEventListener("themechange", fn);
    return function unsubscribe() { document.removeEventListener("themechange", fn); };
  }

  var api = { getTheme: getTheme, setTheme: setTheme, toggleTheme: toggleTheme, initEarly: initEarly, onChange: onChange, THEMES: THEMES };
  global.ThemeUtils = api;
})(window);

