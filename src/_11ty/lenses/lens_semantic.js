/**
 * Lens: Semantic — Heading topology and document structure extraction
 * @version 2.0.0
 */
module.exports = {
  name: 'semantic',
  description: 'Document structure and heading topology analysis',
  analyze(data, meta = {}) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const headings = [...text.matchAll(/^(#{1,6})\s+(.+)$/gm)];
    return {
      lens: 'semantic',
      heading_count: headings.length,
      max_depth: headings.length > 0 ? Math.max(...headings.map(h => h[1].length)) : 0,
      topology: headings.map(h => ({ depth: h[1].length, text: h[2].trim() })),
      confidence: 0.91,
      source: meta.path || 'unknown'
    };
  }
};
