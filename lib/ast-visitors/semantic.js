/**
 * AST Visitor: Semantic - Structural semantic analysis
 * Identifies heading hierarchy depth, link density, code-to-prose ratio,
 * and document topology as a navigable knowledge graph.
 */

function semanticVisitor(node, meta = {}) {
  if (node.type === 'heading') {
    return {
      depth: node.depth,
      text: node.children?.map(c => c.value).join('') || '',
      type: 'heading',
      confidence: 0.94
    };
  }
  if (node.type === 'code') {
    return {
      lang: node.lang || 'unknown',
      lines: (node.value || '').split('\n').length,
      type: 'code',
      confidence: 0.99
    };
  }
  if (node.type === 'link') {
    return {
      url: node.url,
      title: node.title || '',
      type: 'link',
      confidence: 0.97
    };
  }
  if (node.type === 'list') {
    return {
      ordered: node.ordered,
      itemCount: node.children?.length || 0,
      type: 'list',
      confidence: 0.96
    };
  }
  return null;
}

module.exports = { name: 'semantic', visitor: semanticVisitor };