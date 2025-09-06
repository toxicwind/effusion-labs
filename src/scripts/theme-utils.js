export const LIGHT = 'corporate';
export const DARK = 'dim';
const STORAGE_KEY = 'theme';

export function getTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === LIGHT || t === DARK ? t : DARK;
}

export function setTheme(theme, persist = true, source = 'user') {
  const doc = document.documentElement;
  const meta = document.querySelector('meta[name="color-scheme"]');
  doc.setAttribute('data-theme', theme);
  doc.dataset.themeSource = source;
  if (meta)
    meta.setAttribute('content', theme === LIGHT ? 'light dark' : 'dark light');
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
  }
  try {
    document.dispatchEvent(
      new CustomEvent('themechange', { detail: { theme, source } }),
    );
  } catch (_) {}
}
