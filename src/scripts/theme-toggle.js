(function(){
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const sun  = btn.querySelector('.lucide-sun');
  const moon = btn.querySelector('.lucide-moon');

  function apply(theme) {
    const doc = document.documentElement;

    if (theme === 'dark') {
      doc.classList.add('dark');
      doc.setAttribute('data-theme', 'dark');
    } else {
      doc.classList.remove('dark');
      doc.setAttribute('data-theme', 'lab');
    }

    localStorage.setItem('theme', theme);

    if (sun && moon) {
      sun.classList.toggle('hidden', theme !== 'dark');
      moon.classList.toggle('hidden', theme === 'dark');
    }
  }

  btn.addEventListener('click', () => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    apply(next);
  });

  const stored = localStorage.getItem('theme');
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches;
  apply(stored ? stored : (system ? 'dark' : 'light'));
})();
