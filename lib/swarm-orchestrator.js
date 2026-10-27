/**
 * Swarm Orchestrator — Maximal Concurrent Subagent Execution Engine
 * Spawns 18+ concurrent lens agents, manages semaphore pools, DAG dependencies,
 * and result aggregation. Each subagent is an isolated lens+content pair.
 *
 * Architecture: Semaphore pool (default 18) + async generator + result fan-in.
 */

const os = require('os');

class SwarmOrchestrator {
  constructor(opts = {}) {
    this.concurrency = opts.concurrency || parseInt(process.env.SWARM_MAX_CONCURRENCY || '18', 10);
    this.timeoutMs = opts.timeoutMs || parseInt(process.env.SWARM_TIMEOUT_MS || '30000', 10);
    this.retryCount = opts.retryCount || parseInt(process.env.SWARM_RETRY_COUNT || '2', 10);
    this.results = new Map();
    this.errors = new Map();
    this.latency = new Map();
  }

  async execute(tasks) {
    const semaphore = new Array(this.concurrency).fill(null);
    const queue = tasks.map((t, i) => ({ ...t, index: i }));
    const results = new Array(tasks.length);
    const startTime = Date.now();

    await Promise.all(semaphore.map(async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        const taskStart = Date.now();
        let attempt = 0;
        let success = false;

        while (attempt < this.retryCount && !success) {
          try {
            const result = await this._runSubagent(task);
            results[task.index] = {
              status: 'success',
              result,
              latencyMs: Date.now() - taskStart,
              attempts: attempt + 1,
              agentId: task.agentId || `agent-${task.index}`
            };
            success = true;
          } catch (e) {
            attempt++;
            if (attempt >= this.retryCount) {
              results[task.index] = {
                status: 'failed',
                error: e.message,
                latencyMs: Date.now() - taskStart,
                attempts: attempt,
                agentId: task.agentId || `agent-${task.index}`
              };
            }
          }
        }
      }
    }));

    const totalLatency = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'failed').length;

    return {
      totalTasks: tasks.length,
      successCount,
      failCount,
      totalLatencyMs: totalLatency,
      avgLatencyMs: totalLatency / tasks.length,
      concurrency: this.concurrency,
      results
    };
  }

  async _runSubagent(task) {
    const { lensName, content, meta, lensModule } = task;
    if (!lensModule || typeof lensModule.analyze !== 'function') {
      throw new Error(`Invalid lens module for ${lensName}`);
    }
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Subagent timeout after ${this.timeoutMs}ms`)), this.timeoutMs);
    });
    const workPromise = lensModule.analyze(content, meta);
    return Promise.race([workPromise, timeoutPromise]);
  }

  async executeDAG(dag) {
    // DAG: { nodes: [{id, lens, content, meta, deps: []}], edges: [] }
    const completed = new Set();
    const nodeMap = new Map(dag.nodes.map(n => [n.id, n]));
    const results = new Map();

    while (completed.size < dag.nodes.length) {
      const ready = dag.nodes.filter(n =>
        !completed.has(n.id) &&
        (n.deps || []).every(d => completed.has(d))
      );

      if (ready.length === 0 && completed.size < dag.nodes.length) {
        throw new Error('DAG deadlock detected — circular dependency in swarm');
      }

      const tasks = ready.map(n => ({
        agentId: n.id,
        lensName: n.lens,
        content: n.content,
        meta: { ...n.meta, dagNode: n.id, dagDepth: n.depth || 0 },
        lensModule: n.lensModule
      }));

      const batchResult = await this.execute(tasks);

      for (const r of batchResult.results) {
        if (r.status === 'success') {
          completed.add(r.agentId);
          results.set(r.agentId, r.result);
        } else {
          // DAG failure propagation
          throw new Error(`DAG node ${r.agentId} failed: ${r.error}`);
        }
      }
    }

    return { completed: Array.from(completed), results: Object.fromEntries(results) };
  }

  async executeWithFanOut(content, lenses, meta = {}) {
    // Fan-out: one content item -> all lenses in parallel
    const tasks = lenses.map((lens, i) => ({
      agentId: `fanout-${lens.name}-${i}`,
      lensName: lens.name,
      content,
      meta,
      lensModule: lens
    }));
    return this.execute(tasks);
  }

  async executeWithFanIn(contents, lens, meta = {}) {
    // Fan-in: all content items -> one lens in parallel
    const tasks = contents.map((content, i) => ({
      agentId: `fanin-${lens.name}-${i}`,
      lensName: lens.name,
      content,
      meta: { ...meta, contentIndex: i },
      lensModule: lens
    }));
    return this.execute(tasks);
  }
}

module.exports = { SwarmOrchestrator };