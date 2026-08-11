(function(){
  const storageKey = 'theme';
  const doc = document.documentElement;
  const stored = localStorage.getItem(storageKey);
  const meta = document.querySelector('meta[name="color-scheme"]') || (function(){
    const m = document.createElement('meta');
    m.name = 'color-scheme';
    document.head.appendChild(m);
    return m;
  })();
  let theme = stored;
  if (theme !== 'dark' && theme !== 'light') {
    theme = 'dark';
  }
  doc.dataset.theme = theme;
  doc.classList.toggle('dark', theme === 'dark');
  meta.content = theme === 'light' ? 'light dark' : 'dark light';
})();
