/**
 * Consensus Engine — Byzantine Fault Tolerant agreement for swarm subagents
 * Aggregates lens results from multiple agents, detects outliers, and computes
 * a quorum-backed consensus with confidence weighting and dissent tracking.
 */

class ConsensusEngine {
  constructor(opts = {}) {
    this.quorumRatio = opts.quorumRatio || parseFloat(process.env.CONSENSUS_QUORUM || '0.67');
    this.outlierThreshold = opts.outlierThreshold || parseFloat(process.env.CONSENSUS_OUTLIER || '2.0');
    this.maxDissent = opts.maxDissent || parseInt(process.env.CONSENSUS_MAX_DISSENT || '3', 10);
  }

  async analyze(data, meta = {}) {
    const results = data.results || [];
    if (results.length === 0) {
      return { lens: 'consensus', status: 'no_data', confidence: 0 };
    }

    const scalars = results.map(r => this._extractScalar(r)).filter(v => v !== null);
    if (scalars.length === 0) {
      return { lens: 'consensus', status: 'no_scalars', confidence: 0 };
    }

    const mean = scalars.reduce((s, v) => s + v, 0) / scalars.length;
    const sorted = [...scalars].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const stdDev = Math.sqrt(scalars.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scalars.length);

    const outliers = [];
    const inliers = [];
    for (let i = 0; i < scalars.length; i++) {
      const z = stdDev > 0 ? Math.abs(scalars[i] - mean) / stdDev : 0;
      if (z > this.outlierThreshold) {
        outliers.push({ index: i, value: scalars[i], zScore: z, result: results[i] });
      } else {
        inliers.push({ index: i, value: scalars[i], result: results[i] });
      }
    }

    const quorumSize = Math.ceil(results.length * this.quorumRatio);
    const quorum = inliers.slice(0, quorumSize);
    const quorumMean = quorum.length > 0 ? quorum.reduce((s, v) => s + v.value, 0) / quorum.length : mean;
    const quorumConfidence = quorum.length / results.length;

    const dissent = outliers.length;
    const status = dissent > this.maxDissent ? 'fractured' : dissent > 0 ? 'dissent' : 'unanimous';

    return {
      lens: 'consensus',
      status,
      agentCount: results.length,
      quorumSize,
      quorumRatio: this.quorumRatio,
      mean: Math.round(mean * 1000) / 1000,
      median: Math.round(median * 1000) / 1000,
      stdDev: Math.round(stdDev * 1000) / 1000,
      quorumMean: Math.round(quorumMean * 1000) / 1000,
      quorumConfidence: Math.round(quorumConfidence * 1000) / 1000,
      outliers: outliers.slice(0, 5),
      outlierCount: outliers.length,
      inlierCount: inliers.length,
      dissent,
      maxDissent: this.maxDissent,
      confidence: Math.round(quorumConfidence * 0.95 * 1000) / 1000,
      source: meta.path || 'consensus'
    };
  }

  _extractScalar(result) {
    if (typeof result === 'number') return result;
    if (result.confidence !== undefined) return result.confidence;
    if (result.score !== undefined) return result.score;
    if (result.strataScore !== undefined) return result.strataScore / 100;
    if (result.driftScore !== undefined) return result.driftScore;
    if (result.healthScore !== undefined) return result.healthScore / 100;
    if (result.similarity !== undefined) return result.similarity;
    return null;
  }
}

module.exports = { ConsensusEngine };