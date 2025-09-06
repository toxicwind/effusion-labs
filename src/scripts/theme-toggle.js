(function () {
  "use strict";

  var STORAGE_KEY = "theme";
  var LIGHT = "corporate";
  var DARK = "dim";

  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  var doc = document.documentElement;
  var meta = document.querySelector('meta[name="color-scheme"]');
  var sun = btn.querySelector(".lucide-sun");
  var moon = btn.querySelector(".lucide-moon");

  function currentTheme() {
    var t = doc.getAttribute("data-theme");
    return t === DARK ? DARK : LIGHT; // default safe
  }

  function apply(theme, persist, source) {
    doc.setAttribute("data-theme", theme);
    doc.dataset.themeSource = source || "user";

    if (meta) meta.setAttribute("content", theme === LIGHT ? "light dark" : "dark light");
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
    }

    // Button a11y + icon state
    var isDark = theme === DARK;
    btn.setAttribute("aria-pressed", String(isDark));
    btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    if (sun && moon) {
      sun.classList.toggle("hidden", isDark);
      moon.classList.toggle("hidden", !isDark);
    }

    try {
      document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme, source: source || "user" } }));
    } catch (_) {}
  }

  // Initialize button state from current document theme
  apply(currentTheme(), false, "hydrate");

  btn.addEventListener("click", function () {
    var next = currentTheme() === DARK ? LIGHT : DARK;
    apply(next, true, "toggle");
  });
})();
