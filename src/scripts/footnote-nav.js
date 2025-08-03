(function() {
  'use strict';

  function calculateHeaderHeight() {
    const header = document.querySelector('header');
    if (!header) return 80;
    const rect = header.getBoundingClientRect();
    return Math.ceil(rect.height) + 16;
  }

  function updateScrollMargin() {
    const headerHeight = calculateHeaderHeight();
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
  }

  function enhanceFootnoteNavigation() {
    updateScrollMargin();
    window.addEventListener('resize', updateScrollMargin);

    document.addEventListener('click', function(e) {
      const link = e.target.closest('a[href^="#fn"]');
      if (!link) return;
      const href = link.getAttribute('href');
      const targetId = href.substring(1);
      const target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();
      const headerHeight = calculateHeaderHeight();
      const targetRect = target.getBoundingClientRect();
      const scrollTop = window.pageYOffset + targetRect.top - headerHeight;
      window.scrollTo({ top: scrollTop, behavior: 'smooth' });
      history.pushState(null, null, href);
      target.classList.add('footnote-highlight');
      setTimeout(() => target.classList.remove('footnote-highlight'), 3000);
      target.setAttribute('tabindex', '-1');
      target.focus();
    });

    function handleInitialHash() {
      const hash = window.location.hash;
      if (hash && hash.match(/^#fn/)) {
        const target = document.querySelector(hash);
        if (target) {
          setTimeout(() => {
            const headerHeight = calculateHeaderHeight();
            const targetRect = target.getBoundingClientRect();
            const scrollTop = window.pageYOffset + targetRect.top - headerHeight;
            window.scrollTo({ top: scrollTop, behavior: 'smooth' });
            target.classList.add('footnote-highlight');
            setTimeout(() => target.classList.remove('footnote-highlight'), 3000);
          }, 100);
        }
      }
    }

    window.addEventListener('popstate', handleInitialHash);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleInitialHash);
    } else {
      handleInitialHash();
    }
  }

  enhanceFootnoteNavigation();

  const style = document.createElement('style');
  style.textContent = `
    .footnote-highlight {
      background-color: rgba(59, 130, 246, 0.1) !important;
      border-radius: 0.375rem;
      transition: background-color 0.3s ease-in-out;
    }
    @media (prefers-reduced-motion: reduce) {
      .footnote-highlight { transition: none; }
    }
  `;
  document.head.appendChild(style);
})();
