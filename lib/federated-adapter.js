/**
 * Federated Learning Adapter — Distributed lens model training without centralizing data
 * Aggregates lens gradients from multiple nodes, updates shared model weights,
 * and distributes improvements back to the swarm without exposing raw content.
 */

class FederatedAdapter {
  constructor(opts = {}) {
    this.learningRate = opts.learningRate || parseFloat(process.env.FED_LR || '0.01');
    this.batchSize = opts.batchSize || parseInt(process.env.FED_BATCH_SIZE || '16', 10);
    this.rounds = opts.rounds || parseInt(process.env.FED_ROUNDS || '5', 10);
    this.minNodes = opts.minNodes || parseInt(process.env.FED_MIN_NODES || '3', 10);
    this.weights = new Map();
    this.gradients = new Map();
  }

  registerNode(nodeId, initialWeights = {}) {
    this.weights.set(nodeId, { ...initialWeights, _version: 0, _timestamp: new Date().toISOString() });
    this.gradients.set(nodeId, []);
  }

  submitGradient(nodeId, gradient) {
    if (!this.gradients.has(nodeId)) {
      this.registerNode(nodeId);
    }
    this.gradients.get(nodeId).push({
      ...gradient,
      _submitted: new Date().toISOString()
    });
  }

  async aggregateRound() {
    const activeNodes = Array.from(this.gradients.keys()).filter(n => this.gradients.get(n).length > 0);
    if (activeNodes.length < this.minNodes) {
      return { status: 'insufficient_nodes', nodes: activeNodes.length, min: this.minNodes };
    }

    const aggregated = {};
    for (const nodeId of activeNodes) {
      const grads = this.gradients.get(nodeId);
      for (const grad of grads) {
        for (const [key, value] of Object.entries(grad)) {
          if (key.startsWith('_')) continue;
          if (!aggregated[key]) aggregated[key] = { sum: 0, count: 0 };
          aggregated[key].sum += value;
          aggregated[key].count += 1;
        }
      }
    }

    const update = {};
    for (const [key, agg] of Object.entries(aggregated)) {
      update[key] = (agg.sum / agg.count) * this.learningRate;
    }

    // Apply update to all node weights
    for (const nodeId of activeNodes) {
      const current = this.weights.get(nodeId) || {};
      for (const [key, delta] of Object.entries(update)) {
        current[key] = (current[key] || 0) + delta;
      }
      current._version = (current._version || 0) + 1;
      current._timestamp = new Date().toISOString();
      this.weights.set(nodeId, current);
      this.gradients.set(nodeId, []); // clear after aggregation
    }

    return {
      status: 'aggregated',
      nodes: activeNodes.length,
      round: this.rounds,
      updateKeys: Object.keys(update),
      avgDelta: Object.values(update).reduce((s, v) => s + Math.abs(v), 0) / Object.values(update).length
    };
  }

  async train(lensResults, nodeId) {
    // Compute gradient from lens results
    const gradient = {};
    for (const [lensName, result] of Object.entries(lensResults)) {
      const scalar = this._extractScalar(result);
      gradient[lensName] = scalar - 0.5; // center at 0.5
    }
    this.submitGradient(nodeId, gradient);
    return { status: 'submitted', nodeId, gradientKeys: Object.keys(gradient) };
  }

  _extractScalar(result) {
    if (typeof result === 'number') return result;
    if (result.confidence !== undefined) return result.confidence;
    if (result.score !== undefined) return result.score;
    if (result.strataScore !== undefined) return result.strataScore / 100;
    if (result.driftScore !== undefined) return result.driftScore;
    if (result.healthScore !== undefined) return result.healthScore / 100;
    return 0.5;
  }

  getGlobalModel() {
    const allWeights = Array.from(this.weights.values());
    if (allWeights.length === 0) return {};
    const global = {};
    const keys = new Set(allWeights.flatMap(w => Object.keys(w).filter(k => !k.startsWith('_'))));
    for (const key of keys) {
      const values = allWeights.map(w => w[key] || 0).filter(v => v !== undefined);
      global[key] = values.reduce((s, v) => s + v, 0) / values.length;
    }
    return global;
  }

  getNodeWeights(nodeId) {
    return this.weights.get(nodeId);
  }
}

module.exports = { FederatedAdapter };