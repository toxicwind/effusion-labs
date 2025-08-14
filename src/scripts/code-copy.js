document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('pre > code').forEach(code => {
    const pre = code.parentElement;
    const btn = document.createElement('button');
    btn.textContent = 'copy';
    btn.dataset.copy = '';
    btn.style.marginBottom = '0.5rem';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(code.textContent).then(() => {
        btn.textContent = 'copied';
        setTimeout(() => { btn.textContent = 'copy'; }, 2000);
      });
    });
    pre.insertBefore(btn, code);
  });
});
