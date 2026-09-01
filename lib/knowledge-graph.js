/**
 * Knowledge Graph Adapter — Neo4j-style graph construction from lens results
 * Builds entity-relationship graphs from OSINT, dependency, and semantic data.
 * Supports Cypher query generation and graph traversal for insight extraction.
 */

class KnowledgeGraph {
  constructor(opts = {}) {
    this.nodes = new Map();
    this.edges = [];
    this.nodeIdCounter = 0;
  }

  _nodeId() { return `n${++this.nodeIdCounter}`; }

  addNode(label, properties = {}) {
    const id = properties.id || this._nodeId();
    const node = { id, label, properties, timestamp: new Date().toISOString() };
    this.nodes.set(id, node);
    return node;
  }

  addEdge(fromId, toId, type, properties = {}) {
    const edge = { from: fromId, to: toId, type, properties, timestamp: new Date().toISOString() };
    this.edges.push(edge);
    return edge;
  }

  fromOSINT(osintResult, meta = {}) {
    const docNode = this.addNode('Document', { path: meta.path, title: meta.title });
    for (const url of osintResult.urls_found || []) {
      const urlNode = this.addNode('URL', { url, domain: new URL(url).hostname });
      this.addEdge(docNode.id, urlNode.id, 'CONTAINS');
    }
    for (const email of osintResult.emails_found || []) {
      const emailNode = this.addNode('Email', { email });
      this.addEdge(docNode.id, emailNode.id, 'CONTAINS');
    }
    for (const ip of osintResult.ips_found || []) {
      const ipNode = this.addNode('IP', { ip });
      this.addEdge(docNode.id, ipNode.id, 'CONTAINS');
    }
    for (const domain of osintResult.domains_found || []) {
      const domainNode = this.addNode('Domain', { domain });
      this.addEdge(docNode.id, domainNode.id, 'CONTAINS');
    }
    return docNode;
  }

  fromDependencies(depResult, meta = {}) {
    const docNode = this.addNode('Document', { path: meta.path });
    for (const [mod, deps] of Object.entries(depResult.dependencyGraph || {})) {
      const modNode = this.addNode('Module', { name: mod });
      this.addEdge(docNode.id, modNode.id, 'DECLARES');
      for (const dep of deps) {
        const depNode = this.addNode('Dependency', { name: dep, external: !dep.startsWith('.') && !dep.startsWith('@effusion') });
        this.addEdge(modNode.id, depNode.id, 'IMPORTS');
      }
    }
    for (const cycle of depResult.cycles || []) {
      this.addNode('Cycle', { path: cycle, length: cycle.split(' -> ').length });
    }
    return docNode;
  }

  fromStrataDebt(strataResult, meta = {}) {
    const docNode = this.addNode('Document', { path: meta.path, strataScore: strataResult.strataScore });
    for (const [key, layer] of Object.entries(strataResult.layers || {})) {
      const layerNode = this.addNode('StrataLayer', { name: layer.name, count: layer.count, key });
      this.addEdge(docNode.id, layerNode.id, 'HAS_LAYER');
      for (const indicator of layer.indicators || layer.mythosLines || layer.redactionLines || layer.surfaceLines || []) {
        const indNode = this.addNode('Indicator', {
          text: typeof indicator === 'string' ? indicator : indicator.text,
          line: typeof indicator === 'object' ? indicator.line : null
        });
        this.addEdge(layerNode.id, indNode.id, 'CONTAINS');
      }
    }
    return docNode;
  }

  toCypher() {
    const lines = [];
    for (const node of this.nodes.values()) {
      const props = Object.entries(node.properties).map(([k, v]) => {
        const val = typeof v === 'string' ? `"${v.replace(/"/g, '\"')}"` : JSON.stringify(v);
        return `${k}: ${val}`;
      }).join(', ');
      lines.push(`CREATE (${node.id}:${node.label} { ${props}, _id: "${node.id}", _ts: "${node.timestamp}" })`);
    }
    for (const edge of this.edges) {
      lines.push(`CREATE (${edge.from})-[:${edge.type} { _ts: "${edge.timestamp}" }]->(${edge.to})`);
    }
    return lines.join('\n');
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      stats: { nodeCount: this.nodes.size, edgeCount: this.edges.length }
    };
  }

  traverse(fromId, depth = 3) {
    const visited = new Set();
    const queue = [{ id: fromId, depth: 0 }];
    const path = [];
    while (queue.length > 0) {
      const curr = queue.shift();
      if (visited.has(curr.id) || curr.depth > depth) continue;
      visited.add(curr.id);
      path.push(curr.id);
      for (const edge of this.edges) {
        if (edge.from === curr.id && !visited.has(edge.to)) {
          queue.push({ id: edge.to, depth: curr.depth + 1 });
        }
      }
    }
    return path.map(id => this.nodes.get(id)).filter(Boolean);
  }
}

module.exports = { KnowledgeGraph };