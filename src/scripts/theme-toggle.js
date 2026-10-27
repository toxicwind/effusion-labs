(function(){
  const storageKey = 'theme';
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const doc = document.documentElement;
  const meta = document.querySelector('meta[name="color-scheme"]');
  const sun = btn.querySelector('.lucide-sun');
  const moon = btn.querySelector('.lucide-moon');

  function apply(theme, persist){
    doc.dataset.theme = theme;
    doc.classList.toggle('dark', theme === 'dark');
    meta && (meta.content = theme === 'light' ? 'light dark' : 'dark light');
    if (persist) localStorage.setItem(storageKey, theme);
    btn.setAttribute('aria-pressed', theme === 'dark');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    if(sun && moon){
      sun.classList.toggle('hidden', theme === 'dark');
      moon.classList.toggle('hidden', theme !== 'dark');
    }
  }

  apply(doc.dataset.theme || 'dark', false);

  btn.addEventListener('click', () => {
    const next = doc.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next, true);
  });
})();
