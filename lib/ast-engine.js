/**
 * AST Engine - Abstract Syntax Tree core for agentic content perception
 * Parses Markdown/MDX into unified AST, applies lens visitors, serializes annotations.
 * 
 * Architecture: Every piece of content is a tree. Every lens is a visitor.
 * The swarm DAG traverses the tree in parallel, attaching metadata to nodes.
 */

const { remark } = require('remark');
const { visit } = require('unist-util-visit');
const { selectAll } = require('unist-util-select');

class ASTEngine {
  constructor(opts = {}) {
    this.parser = remark();
    this.visitors = new Map();
    this.annotations = new Map(); // node -> { lens: result }
    this.nodeIdCounter = 0;
  }

  async parse(content) {
    const tree = await this.parser.parse(content);
    this._assignNodeIds(tree);
    return tree;
  }

  _assignNodeIds(node) {
    if (!node.data) node.data = {};
    node.data._astId = ++this.nodeIdCounter;
    if (node.children) {
      for (const child of node.children) this._assignNodeIds(child);
    }
  }

  registerVisitor(lensName, visitorFn) {
    this.visitors.set(lensName, visitorFn);
  }

  async applyVisitor(tree, lensName, meta = {}) {
    const visitor = this.visitors.get(lensName);
    if (!visitor) throw new Error(`Visitor "${lensName}" not registered`);

    const results = [];
    visit(tree, (node) => {
      const result = visitor(node, meta);
      if (result) {
        results.push({ nodeId: node.data?._astId, type: node.type, result });
        if (!node.data) node.data = {};
        if (!node.data.lensResults) node.data.lensResults = {};
        node.data.lensResults[lensName] = result;
      }
    });
    return results;
  }

  async applyAllVisitors(tree, meta = {}) {
    const allResults = {};
    for (const [name, visitor] of this.visitors) {
      allResults[name] = await this.applyVisitor(tree, name, meta);
    }
    return allResults;
  }

  queryNodes(tree, selector) {
    return selectAll(selector, tree);
  }

  serializeAnnotations(tree) {
    const flat = [];
    visit(tree, (node) => {
      if (node.data?.lensResults) {
        flat.push({
          nodeId: node.data._astId,
          type: node.type,
          position: node.position,
          lensResults: node.data.lensResults
        });
      }
    });
    return flat;
  }

  async transform(content, visitors, meta = {}) {
    const tree = await this.parse(content);
    const results = await this.applyAllVisitors(tree, meta);
    const annotations = this.serializeAnnotations(tree);
    return { tree, results, annotations };
  }
}

module.exports = { ASTEngine };