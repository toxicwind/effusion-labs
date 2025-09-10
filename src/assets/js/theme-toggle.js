(function () {
  "use strict";

  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  var utils = window.ThemeUtils || null;
  var sun = btn.querySelector(".lucide-sun");
  var moon = btn.querySelector(".lucide-moon");

  function reflect(theme) {
    var dark = (utils ? utils.THEMES.dark : "dark");
    var isDark = theme === dark;
    btn.setAttribute("aria-pressed", String(isDark));
    btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    if (sun && moon) {
      sun.classList.toggle("hidden", isDark);
      moon.classList.toggle("hidden", !isDark);
    }
  }

  // Initial reflect from current document state
  reflect((utils && utils.getTheme()) || document.documentElement.getAttribute("data-theme") || "light");

  if (utils) {
    btn.addEventListener("click", function () { reflect(utils.toggleTheme(true)); });
    utils.onChange(reflect);
  } else {
    // Minimal fallback toggle if ThemeUtils is not present (shouldn't happen)
    btn.addEventListener("click", function () {
      var el = document.documentElement;
      var cur = el.getAttribute("data-theme") || "light";
      var next = cur === "dark" ? "light" : "dark";
      el.setAttribute("data-theme", next);
      reflect(next);
    });
  }
})();
