function computeSeed(mode = 'page', forced, storage) {
  if (forced) return String(forced);
  if (mode === 'session' && storage) {
    const existing = storage.getItem('mschfSeed');
    if (existing) return existing;
    const newSeed = randomInt();
    storage.setItem('mschfSeed', newSeed);
    return newSeed;
  }
  return randomInt();
}

function randomInt() {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString();
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, t | 1);
    r ^= r + Math.imul(r ^ r >>> 7, r | 61);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

function init() {
  const shell = document.getElementById('page-shell');
  if (!shell) return;
  if (shell.dataset.mschf === 'off') return;
  if (localStorage.getItem('mschf:off')) return;

  const intensity = shell.dataset.mschfIntensity || 'lite';
  const mode = shell.dataset.mschfSeedMode || 'page';
  const forced = new URL(window.location.href).searchParams.get('mschf-seed');
  const seed = computeSeed(mode, forced, window.sessionStorage);
  const rand = mulberry32(parseInt(seed, 10) || 0);

  const root = document.getElementById('mschf-overlay-root');
  if (!root) return;
  root.innerHTML = '';
  root.style.pointerEvents = 'none';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '10';
  root.setAttribute('aria-hidden', 'true');

  if (intensity === 'loud' && rand() < 0.35) {
    const grid = document.createElement('div');
    grid.className = 'mschf-grid';
    root.appendChild(grid);
  }

  const crossProb = intensity === 'loud' ? 0.6 : 0.5;
  if (rand() < crossProb) {
    const cross = document.createElement('div');
    cross.className = 'mschf-crosshair';
    cross.innerHTML = '<div class="mschf-crosshair-ring"></div>' +
      '<div class="mschf-crosshair-v"></div>' +
      '<div class="mschf-crosshair-h"></div>';
    root.appendChild(cross);
  }
}

document.addEventListener('DOMContentLoaded', init);
