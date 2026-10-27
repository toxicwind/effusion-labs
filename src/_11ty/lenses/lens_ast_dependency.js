/**
 * Lens: AST Dependency Graph - Extracts import/require graphs from code blocks in Markdown
 * Parses JavaScript/TypeScript/Python code blocks to build a dependency graph
 * that can be visualized or analyzed for circular dependencies.
 */

const JS_IMPORT_RE = /(?:import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
const PY_IMPORT_RE = /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/g;
const GO_IMPORT_RE = /import\s+(?:\(\s*)?(?:[_\w]*\s+)?['"]([^'"]+)['"]/g;

function extractDeps(code, lang) {
  const deps = [];
  let match;
  if (lang === 'js' || lang === 'ts' || lang === 'javascript' || lang === 'typescript') {
    while ((match = JS_IMPORT_RE.exec(code)) !== null) {
      deps.push(match[1] || match[2]);
    }
  } else if (lang === 'py' || lang === 'python') {
    while ((match = PY_IMPORT_RE.exec(code)) !== null) {
      deps.push(match[1] || match[2]);
    }
  } else if (lang === 'go' || lang === 'golang') {
    while ((match = GO_IMPORT_RE.exec(code)) !== null) {
      deps.push(match[1]);
    }
  }
  return [...new Set(deps)].filter(d => d && !d.startsWith('.') && !d.startsWith('/'));
}

function detectCircular(graph) {
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart).concat([neighbor]));
      }
    }

    recStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) dfs(node, []);
  }
  return cycles;
}

module.exports = {
  name: 'ast_dependency',
  description: 'Extracts dependency graphs from code blocks in Markdown AST',

  analyze(data, meta = {}) {
    const codeBlocks = data.codeBlocks || [];
    const graph = {};
    const allDeps = [];
    const langStats = {};

    for (const block of codeBlocks) {
      const lang = block.lang || 'unknown';
      langStats[lang] = (langStats[lang] || 0) + 1;
      const deps = extractDeps(block.code, lang);
      if (deps.length > 0) {
        graph[block.id || block.lang] = deps;
        allDeps.push(...deps);
      }
    }

    const cycles = detectCircular(graph);
    const externalDeps = allDeps.filter(d => !d.startsWith('@effusion') && !d.startsWith('./') && !d.startsWith('../'));
    const internalDeps = allDeps.filter(d => d.startsWith('@effusion') || d.startsWith('./') || d.startsWith('../'));

    return {
      lens: 'ast_dependency',
      codeBlockCount: codeBlocks.length,
      languages: Object.keys(langStats),
      langDistribution: langStats,
      dependencyGraph: graph,
      totalDeps: allDeps.length,
      externalDeps: [...new Set(externalDeps)],
      internalDeps: [...new Set(internalDeps)],
      circularDependencies: cycles.length,
      cycles: cycles.map(c => c.join(' -> ')),
      hasCycles: cycles.length > 0,
      confidence: 0.89,
      source: meta.path || 'unknown'
    };
  }
};