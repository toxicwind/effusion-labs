export function randomInt() { return crypto.getRandomValues(new Uint32Array(1))[0].toString(); }
export function mulberry32(seed) {
  let t = seed >>> 0; return function () {
    t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export function computeSeed(mode = "page", forced, storage) {
  if (forced) return String(forced);
  if (mode === "session" && storage) {
    const existing = storage.getItem("mschfSeed");
    if (existing) return existing;
    const next = randomInt(); storage.setItem("mschfSeed", next); return next;
  }
  return randomInt();
}