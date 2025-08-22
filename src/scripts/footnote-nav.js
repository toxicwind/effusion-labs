// /assets/js/footnote-nav.js
(function () {
  "use strict";

  // --- Config ---------------------------------------------------------------
  var HIGHLIGHT_MS = 2200; // matches CSS @keyframes footnote-highlight duration
  var EXTRA_OFFSET_PX = 16; // small breathing room under sticky header

  // --- Header height / scroll margin ---------------------------------------
  function getHeaderEl() {
    return (
      document.querySelector("[data-site-header]") ||
      document.querySelector('[role="banner"]') ||
      document.querySelector("header.site-header") ||
      document.querySelector("body > header") ||
      document.querySelector("header")
    );
  }

  function readCssHeaderHeightVar() {
    var v = getComputedStyle(document.documentElement).getPropertyValue(
      "--header-height"
    );
    var n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function calculateHeaderHeight() {
    var fromVar = readCssHeaderHeightVar();
    if (fromVar != null) return Math.ceil(fromVar);

    var header = getHeaderEl();
    if (!header) return 80 + EXTRA_OFFSET_PX;

    var rect = header.getBoundingClientRect();
    return Math.ceil(rect.height) + EXTRA_OFFSET_PX;
  }

  function setHeaderHeightVar(px) {
    document.documentElement.style.setProperty("--header-height", px + "px");
  }

  function updateScrollMargin() {
    setHeaderHeightVar(calculateHeaderHeight());
  }

  // Throttle resize to rAF
  var resizeRaf = 0;
  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      updateScrollMargin();
    });
  }

  // Also react if the header itself resizes
  function watchHeader() {
    var header = getHeaderEl();
    if (!("ResizeObserver" in window) || !header) return;
    var ro = new ResizeObserver(updateScrollMargin);
    ro.observe(header);
  }

  // --- Scrolling + highlighting --------------------------------------------
  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function scrollToTarget(target, opts) {
    if (!target) return;
    var headerHeight = calculateHeaderHeight();
    var rect = target.getBoundingClientRect();
    var top = window.pageYOffset + rect.top - headerHeight;
    var behavior = prefersReducedMotion() ? "auto" : "smooth";
    window.scrollTo({ top: Math.max(0, top), behavior: behavior });

    if (!(opts && opts.skipHistory)) {
      var id = target.id ? "#" + target.id : "";
      if (id && id !== location.hash) {
        try {
          history.pushState(null, "", id);
        } catch (_) {}
      }
    }
    applyHighlight(target);
  }

  function applyHighlight(target) {
    // Focus safely without permanently mutating tabindex
    var hadTabindex = target.hasAttribute("tabindex");
    var prevTabindex = target.getAttribute("tabindex");
    if (!hadTabindex) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });

    target.classList.add("footnote-highlight");
    setTimeout(function () {
      target.classList.remove("footnote-highlight");
      if (!hadTabindex) {
        target.removeAttribute("tabindex");
      } else if (prevTabindex !== null) {
        target.setAttribute("tabindex", prevTabindex);
      }
    }, HIGHLIGHT_MS);
  }

  // --- Event wiring ---------------------------------------------------------
  function isFootnoteHref(href) {
    // handle #fn1, #fnref1, etc.
    return /^#fn(ref)?/i.test(href || "");
  }

  function handleClick(e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute("href");
    if (!isFootnoteHref(href)) return;

    var id = href.slice(1);
    var target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();
    scrollToTarget(target);
  }

  function handleInitialHash() {
    var hash = window.location.hash;
    if (!isFootnoteHref(hash)) return;
    var target = document.getElementById(hash.slice(1));
    if (!target) return;

    // Wait a tick for layout to settle (fonts, images)
    setTimeout(function () {
      scrollToTarget(target, { skipHistory: true });
    }, 50);
  }

  function enhanceFootnoteNavigation() {
    updateScrollMargin();
    watchHeader();

    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("click", handleClick, false);
    window.addEventListener("popstate", handleInitialHash, false);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", handleInitialHash, { once: true });
    } else {
      handleInitialHash();
    }
  }

  // Opt-out: allow a page to disable smoothing globally
  if (!document.documentElement.hasAttribute("data-no-smooth-scroll")) {
    enhanceFootnoteNavigation();
  }
})();
