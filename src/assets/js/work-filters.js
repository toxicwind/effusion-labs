document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('[data-filter]');
  const items = document.querySelectorAll('#work-list > li');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      const filter = btn.dataset.filter;
      items.forEach(li => {
        const type = li.dataset.type;
        li.classList.toggle('hidden', filter !== 'all' && type !== filter);
      });
    });
  });
});
