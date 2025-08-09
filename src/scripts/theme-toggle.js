(function() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const html = document.documentElement;
  const sun = btn.querySelector('.lucide-sun');
  const moon = btn.querySelector('.lucide-moon');

  function apply(theme) {
    html.setAttribute('data-theme', theme);
    html.classList.toggle('dark', theme === 'dark');
    if (sun && moon) {
      sun.classList.toggle('hidden', theme === 'dark');
      moon.classList.toggle('hidden', theme !== 'dark');
    }
  }

  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = stored || (prefersDark ? 'dark' : 'lab');
  apply(initial);

  btn.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'lab' : 'dark';
    localStorage.setItem('theme', next);
    apply(next);
  });
})();
