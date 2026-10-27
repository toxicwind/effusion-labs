/**
 * AST Visitor: OSINT - Infrastructure reconnaissance as tree traversal
 * Extracts URLs, emails, IPs, domains from link nodes and text nodes.
 */

const URL_RE = /https?:\/\/[^\s\"<>]+/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const DOMAIN_RE = /\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

function osintVisitor(node, meta = {}) {
  const text = node.value || (node.children?.map(c => c.value).join(' ')) || '';
  const urls = [...text.matchAll(URL_RE)].map(m => m[0]);
  const emails = [...text.matchAll(EMAIL_RE)].map(m => m[0]);
  const ips = [...text.matchAll(IP_RE)].map(m => m[0]);
  const domains = [...text.matchAll(DOMAIN_RE)].map(m => m[0]).filter(d => !d.includes('@'));

  const allFound = [...urls, ...emails, ...ips, ...domains];
  if (allFound.length === 0) return null;

  return {
    urls: [...new Set(urls)],
    emails: [...new Set(emails)],
    ips: [...new Set(ips)],
    domains: [...new Set(domains)],
    iocCount: allFound.length,
    confidence: 0.82,
    nodeType: node.type
  };
}

module.exports = { name: 'osint', visitor: osintVisitor };