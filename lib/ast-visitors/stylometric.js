/**
 * AST Visitor: Stylometric - Linguistic fingerprinting as tree traversal
 * Operates on text nodes in the AST, computing entropy per paragraph/heading.
 */

function stylometricVisitor(node, meta = {}) {
  if (node.type !== 'text' && node.type !== 'paragraph' && node.type !== 'heading') return null;
  const text = node.value || (node.children?.map(c => c.value).join(' ')) || '';
  if (text.length < 20) return null;

  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const freqs = {};
  words.forEach(w => freqs[w] = (freqs[w] || 0) + 1);
  const total = words.length;
  const unique = Object.keys(freqs).length;

  const entropy = -Object.values(freqs).reduce((sum, c) => {
    const p = c / total;
    return sum + (p > 0 ? p * Math.log2(p) : 0);
  }, 0);

  return {
    wordCount: total,
    uniqueRatio: total > 0 ? unique / total : 0,
    entropy: Math.round(entropy * 100) / 100,
    avgWordLen: total > 0 ? words.reduce((s, w) => s + w.length, 0) / total : 0,
    confidence: 0.88,
    nodeType: node.type
  };
}

module.exports = { name: 'stylometric', visitor: stylometricVisitor };