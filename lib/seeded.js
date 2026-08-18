const MS_PER_DAY = 1000 * 60 * 60 * 24;

function dailySeed(utcDate) {
  if (process.env.HOMEPAGE_SEED) return process.env.HOMEPAGE_SEED;
  const date = utcDate || new Date().toISOString().slice(0, 10);
  const hash = process.env.BUILD_HASH || process.env.GITHUB_SHA || '';
  return `${date}-${hash}`;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return mulberry32(h);
}

function seededShuffle(arr, seedStr) {
  const rng = createRng(seedStr);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { dailySeed, seededShuffle };
