(function(){
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const sun = btn.querySelector('.lucide-sun');
  const moon = btn.querySelector('.lucide-moon');
  function apply(theme){
    if(theme === 'dark'){
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme','dark');
      if(sun && moon){
        sun.classList.remove('hidden');
        moon.classList.add('hidden');
      }
    }else{
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme','light');
      if(sun && moon){
        moon.classList.remove('hidden');
        sun.classList.add('hidden');
      }
    }
  }
  btn.addEventListener('click',()=>{
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    apply(next);
  });
  const stored = localStorage.getItem('theme');
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches;
  apply(stored ? stored : (system ? 'dark':'light'));
})();
