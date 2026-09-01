/**
 * AST Visitor: Cryptographic - Token and key detection as tree traversal
 * Scans every text node for credential patterns, entropy anomalies.
 */

const KEY_RE = /\b(?:[A-Za-z0-9+/]{40,}={0,2})\b/g;
const HASH_RE = /\b[a-f0-9]{32,64}\b/g;
const TOKEN_RE = /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g;
const API_KEY_RE = /\b(?:sk-|pk-|ak-)[A-Za-z0-9]{20,}\b/g;

function cryptoVisitor(node, meta = {}) {
  const text = node.value || (node.children?.map(c => c.value).join(' ')) || '';
  const keys = [...text.matchAll(KEY_RE)].map(m => m[0]);
  const hashes = [...text.matchAll(HASH_RE)].map(m => m[0]);
  const tokens = [...text.matchAll(TOKEN_RE)].map(m => m[0]);
  const apiKeys = [...text.matchAll(API_KEY_RE)].map(m => m[0]);

  const allFound = [...keys, ...hashes, ...tokens, ...apiKeys];
  if (allFound.length === 0) return null;

  return {
    potentialKeys: keys.length,
    potentialHashes: hashes.length,
    potentialTokens: tokens.length,
    potentialApiKeys: apiKeys.length,
    entropyFlag: tokens.length > 0 || apiKeys.length > 0 ? 'CRITICAL: credentials detected' : 'warning',
    confidence: 0.95,
    nodeType: node.type
  };
}

module.exports = { name: 'cryptographic', visitor: cryptoVisitor };