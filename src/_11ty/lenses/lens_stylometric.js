/**
 * Lens: Stylometric — Linguistic fingerprinting and authorship attribution
 * Ported from toxicwind/additional-lens-profiles lens_stylometric.py
 */

function trigrams(text) {
  const chars = text.toLowerCase().replace(/\s+/g, ' ');
  const tri = [];
  for (let i = 0; i < chars.length - 2; i++) tri.push(chars.slice(i, i + 3));
  const freq = {};
  tri.forEach(t => freq[t] = (freq[t] || 0) + 1);
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
}

function entropy(freqs, total) {
  return -Object.values(freqs).reduce((sum, c) => {
    const p = c / total;
    return sum + (p > 0 ? p * Math.log2(p) : 0);
  }, 0);
}

module.exports = {
  name: 'stylometric',
  description: 'Linguistic fingerprinting and authorship attribution',
  analyze(data, meta = {}) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const freqs = {};
    words.forEach(w => freqs[w] = (freqs[w] || 0) + 1);
    const total = words.length;

    return {
      lens: 'stylometric',
      word_count: total,
      unique_ratio: total > 0 ? Object.keys(freqs).length / total : 0,
      top_trigrams: trigrams(text),
      avg_word_len: total > 0 ? words.reduce((s, w) => s + w.length, 0) / total : 0,
      entropy: total > 0 ? entropy(freqs, total) : 0,
      confidence: 0.88,
      source: meta.path || 'unknown'
    };
  }
};
