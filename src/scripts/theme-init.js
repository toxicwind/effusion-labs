(function () {
  "use strict";

  var STORAGE_KEY = "theme";
  var LIGHT = "nord";
  var DARK = "sunset";
  var LEGACY_MAP = { light: LIGHT, dark: DARK };

  function ensureMetaColorScheme() {
    var m =
      document.querySelector('meta[name="color-scheme"]') ||
      (function () {
        var x = document.createElement("meta");
        x.setAttribute("name", "color-scheme");
        document.head.appendChild(x);
        return x;
      })();
    return m;
  }

  function normalizeStored(val) {
    if (!val) return null;
    val = String(val).trim();
    if (val === LIGHT || val === DARK) return val;
    if (val === "light" || val === "dark") return LEGACY_MAP[val];
    return null;
  }

  function pickInitialTheme() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var stored = normalizeStored(raw);
      if (stored) return { theme: stored, source: "storage" };
    } catch (_) {}
    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return { theme: prefersDark ? DARK : LIGHT, source: prefersDark ? "os-dark" : "os-light" };
  }

  function setTheme(theme, source) {
    var doc = document.documentElement;
    doc.setAttribute("data-theme", theme);
    doc.dataset.themeSource = source || "init";

    // Update UA hint for form controls/scrollbars
    var meta = ensureMetaColorScheme();
    meta.setAttribute("content", theme === LIGHT ? "light dark" : "dark light");

    // Broadcast (optional listeners can react)
    try {
      document.dispatchEvent(
        new CustomEvent("themechange", { detail: { theme: theme, source: source } })
      );
    } catch (_) {}
  }

  var picked = pickInitialTheme();
  setTheme(picked.theme, picked.source);
})();
