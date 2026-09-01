/**
 * Lens: Cryptographic — Pattern detection for keys, hashes, tokens
 */
const KEY_RE = /\b(?:[A-Za-z0-9+/]{40,}={0,2})\b/g;
const HASH_RE = /\b[a-f0-9]{32,64}\b/g;
const TOKEN_RE = /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g;

module.exports = {
  name: 'cryptographic',
  description: 'Cryptographic artifact detection and entropy analysis',
  analyze(data, meta = {}) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const keys = [...text.matchAll(KEY_RE)].map(m => m[0]);
    const hashes = [...text.matchAll(HASH_RE)].map(m => m[0]);
    const tokens = [...text.matchAll(TOKEN_RE)].map(m => m[0]);

    return {
      lens: 'cryptographic',
      potential_keys: keys.length,
      potential_hashes: hashes.length,
      potential_tokens: tokens.length,
      entropy_flag: tokens.length > 0 ? 'CRITICAL: tokens detected' : 'clean',
      confidence: 0.95,
      source: meta.path || 'unknown'
    };
  }
};
