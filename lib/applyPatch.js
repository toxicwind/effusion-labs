/**
 * Apply an array of patch instructions to a string.
 * Each patch: { start, deleteCount, insert }
 * Patches are applied from the end toward the start to avoid index drift.
 * Throws on overlapping or out-of-bounds patches.
 */
export default function applyPatch(text, patches = []) {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }
  if (!Array.isArray(patches)) {
    throw new TypeError('patches must be array');
  }
  // Normalize and sort patches by start descending
  const ops = patches.map((p, i) => ({
    s: p.start,
    d: p.deleteCount ?? 0,
    i: p.insert ?? '',
    _i: i
  })).sort((a, b) => b.s - a.s);

  // Detect overlap
  for (let j = 1; j < ops.length; j++) {
    const prev = ops[j - 1];
    const cur = ops[j];
    if (cur.s + cur.d > prev.s) {
      throw new RangeError(`patch ${cur._i} overlaps with ${prev._i}`);
    }
  }

  let out = text;
  for (const op of ops) {
    if (op.s < 0 || op.s > out.length) {
      throw new RangeError(`patch ${op._i} out of range`);
    }
    out = out.slice(0, op.s) + op.i + out.slice(op.s + op.d);
  }
  return out;
}
