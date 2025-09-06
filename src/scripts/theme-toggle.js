import { LIGHT, DARK, getTheme, setTheme } from './theme-utils.js';

(function () {
  'use strict';

  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  var sun = btn.querySelector('.lucide-sun');
  var moon = btn.querySelector('.lucide-moon');

  function sync() {
    var theme = getTheme();
    var isDark = theme === DARK;
    btn.setAttribute('aria-pressed', String(isDark));
    btn.setAttribute(
      'aria-label',
      isDark ? 'Switch to light theme' : 'Switch to dark theme',
    );
    if (sun && moon) {
      sun.classList.toggle('hidden', isDark);
      moon.classList.toggle('hidden', !isDark);
    }
  }

  sync();

  btn.addEventListener('click', function () {
    var next = getTheme() === DARK ? LIGHT : DARK;
    setTheme(next);
    sync();
  });
})();
