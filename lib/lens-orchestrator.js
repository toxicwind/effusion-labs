/**
 * Lens Orchestrator — First-Class Agentic Perception Layer
 * Auto-discovers lens_*.js modules from src/_11ty/lenses/
 * Bridges Eleventy build pipeline with the NVIDIA Swarm DAG engine.
 *
 * @module lens-orchestrator
 * @version 2.0.0-agentic
 */

const fs = require('fs').promises;
const { ASTEngine } = require('./ast-engine');
const { SwarmOrchestrator } = require('./swarm-orchestrator');
const { SubagentRegistry } = require('./subagent-registry');
const path = require('path');
const { spawn } = require('child_process');

const LENS_DIR = path.resolve(__dirname, '../src/_11ty/lenses');
const SWARM_ENABLED = process.env.LENS_ENABLED === 'true';
const SWARM_CONCURRENCY = parseInt(process.env.LENS_SWARM_CONCURRENCY || '16', 10);

class LensOrchestrator {
  constructor(opts = {}) {
    this.lensDir = opts.lensDir || LENS_DIR;
    this.useSwarm = opts.useSwarm ?? SWARM_ENABLED;
    this.concurrency = opts.concurrency || SWARM_CONCURRENCY;
    this.lenses = new Map();
    this.results = new Map();
    this.astEngine = new ASTEngine();
    this.swarm = new SwarmOrchestrator(opts);
    this.registry = new SubagentRegistry(opts);
  }

  async discover() {
    const entries = await fs.readdir(this.lensDir).catch(() => []);
    const lensFiles = entries
      .filter(f => f.startsWith('lens_') && f.endsWith('.js'))
      .filter(f => f !== 'lens_loader.js');

    for (const file of lensFiles) {
      const modPath = path.join(this.lensDir, file);
      try {
        const mod = require(modPath);
        if (mod.name && typeof mod.analyze === 'function') {
          this.lenses.set(mod.name, mod);
        }
      } catch (e) {
        console.warn(`[lens] Failed to load ${file}: ${e.message}`);
      }
    }
    console.log(`[lens] Discovered ${this.lenses.size} lens profiles`);
    return Array.from(this.lenses.values());
  }

  async analyze(lensName, content, meta = {}) {
    const lens = this.lenses.get(lensName);
    if (!lens) throw new Error(`Lens "${lensName}" not discovered`);

    const start = Date.now();
    const result = await lens.analyze(content, meta);
    result._meta = {
      lens: lensName,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
      build_id: process.env.EFFUSION_BUILD_ID || 'local'
    };
    return result;
  }

  async analyzeAll(content, meta = {}) {
    if (!this.useSwarm || this.lenses.size === 0) {
      const results = {};
      for (const [name, lens] of this.lenses) {
        results[name] = await this.analyze(name, content, meta);
      }
      return results;
    }

    // Swarm DAG: parallel execution across all lenses
    const pool = new Array(this.concurrency).fill(null);
    const queue = Array.from(this.lenses.entries()).map(([name, lens]) => ({ name, lens }));
    const results = {};

    await Promise.all(pool.map(async () => {
      while (queue.length) {
        const { name, lens } = queue.shift();
        try {
          const start = Date.now();
          const r = await lens.analyze(content, meta);
          r._meta = { lens: name, latency_ms: Date.now() - start, timestamp: new Date().toISOString() };
          results[name] = r;
        } catch (e) {
          results[name] = { error: e.message, _meta: { lens: name } };
        }
      }
    }));

    return results;
  }

  async runBuildPipeline(allContent) {
    console.log('[lens] Running build-time lens pipeline...');
    const manifest = { generated: new Date().toISOString(), items: [] };

    for (const item of allContent) {
      const results = await this.analyzeAll(item.content, {
        path: item.inputPath,
        title: item.data?.title,
        tags: item.data?.tags
      });
      manifest.items.push({
        path: item.inputPath,
        title: item.data?.title,
        lens_results: results
      });
    }

    const outPath = path.resolve(__dirname, '../src/_data/lensManifest.json');
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(manifest, null, 2));
    console.log(`[lens] Wrote lens manifest: ${outPath}`);
    return manifest;
  }
}



  async analyzeAST(content, meta = {}) {
    const tree = await this.astEngine.parse(content);
    const visitors = await this.discoverASTVisitors();
    for (const [name, visitor] of visitors) {
      this.astEngine.registerVisitor(name, visitor);
    }
    const results = await this.astEngine.applyAllVisitors(tree, meta);
    const annotations = this.astEngine.serializeAnnotations(tree);
    return { tree, results, annotations };
  }

  async discoverASTVisitors(directory = './lib/ast-visitors') {
    const visitors = new Map();
    const entries = await fs.readdir(directory).catch(() => []);
    for (const file of entries.filter(f => f.endsWith('.js'))) {
      const modPath = require('path').resolve(directory, file);
      try {
        const mod = require(modPath);
        if (mod.name && typeof mod.visitor === 'function') {
          visitors.set(mod.name, mod.visitor);
        }
      } catch (e) {
        console.warn(`[ast] Failed to load visitor ${file}: ${e.message}`);
      }
    }
    return visitors;
  }



  async swarmAnalyzeAll(content, meta = {}) {
    await this.discover();
    const lenses = Array.from(this.lenses.values());
    return await this.swarm.executeWithFanOut(content, lenses, meta);
  }

  async swarmAnalyzeDAG(contents, dagSpec, meta = {}) {
    await this.discover();
    const nodes = dagSpec.nodes.map(n => ({
      ...n,
      lensModule: this.lenses.get(n.lens)
    }));
    return await this.swarm.executeDAG({ nodes, edges: dagSpec.edges || [] });
  }

  async discoverAndRegister() {
    await this.discover();
    await this.registry.discoverAll();
    console.log(`[swarm] Registered ${this.registry.agents.size} subagents`);
    return this.registry.agents.size;
  }

module.exports = { LensOrchestrator };
