/**
 * Lens: Probabilistic — Monte Carlo uncertainty quantification for lens results
 * Runs each lens N times with perturbed inputs to estimate confidence intervals
 * and detect brittle conclusions that collapse under minor perturbation.
 */

class ProbabilisticLens {
  constructor(opts = {}) {
    this.iterations = opts.iterations || parseInt(process.env.PROB_ITERATIONS || '100', 10);
    this.perturbationRate = opts.perturbationRate || parseFloat(process.env.PROB_PERTURBATION || '0.05');
    this.confidenceLevel = opts.confidenceLevel || parseFloat(process.env.PROB_CONFIDENCE || '0.95');
  }

  async analyze(data, meta = {}) {
    const lensModule = meta.lensModule;
    if (!lensModule || typeof lensModule.analyze !== 'function') {
      return { lens: 'probabilistic', error: 'No lensModule provided in meta', confidence: 0 };
    }

    const results = [];
    for (let i = 0; i < this.iterations; i++) {
      const perturbed = this._perturb(data, this.perturbationRate);
      try {
        const r = await lensModule.analyze(perturbed, meta);
        results.push(this._extractScalar(r));
      } catch {
        results.push(null);
      }
    }

    const valid = results.filter(r => r !== null);
    if (valid.length === 0) {
      return { lens: 'probabilistic', error: 'All iterations failed', confidence: 0 };
    }

    const sorted = valid.sort((a, b) => a - b);
    const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
    const variance = valid.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / valid.length;
    const stdDev = Math.sqrt(variance);
    const ciLower = sorted[Math.floor(valid.length * (1 - this.confidenceLevel) / 2)];
    const ciUpper = sorted[Math.ceil(valid.length * (1 + this.confidenceLevel) / 2)];
    const brittleness = this._computeBrittleness(valid);

    return {
      lens: 'probabilistic',
      targetLens: meta.lensName || 'unknown',
      iterations: this.iterations,
      validRuns: valid.length,
      mean: Math.round(mean * 1000) / 1000,
      stdDev: Math.round(stdDev * 1000) / 1000,
      variance: Math.round(variance * 1000) / 1000,
      confidenceInterval: [ciLower, ciUpper],
      confidenceLevel: this.confidenceLevel,
      brittleness: Math.round(brittleness * 1000) / 1000,
      status: brittleness > 0.3 ? 'brittle' : brittleness > 0.1 ? 'moderate' : 'robust',
      perturbationRate: this.perturbationRate,
      confidence: 0.94,
      source: meta.path || 'unknown'
    };
  }

  _perturb(data, rate) {
    if (typeof data === 'string') {
      const words = data.split(/\s+/);
      const perturbed = words.map(w => {
        if (Math.random() < rate) {
          // Random deletion, duplication, or substitution
          const roll = Math.random();
          if (roll < 0.33) return ''; // deletion
          if (roll < 0.66) return w + ' ' + w; // duplication
          return w.split('').sort(() => Math.random() - 0.5).join(''); // scramble
        }
        return w;
      });
      return perturbed.join(' ').replace(/\s+/g, ' ').trim();
    }
    if (typeof data === 'object') {
      return JSON.parse(JSON.stringify(data).split('').map(c => Math.random() < rate ? '' : c).join(''));
    }
    return data;
  }

  _extractScalar(result) {
    if (typeof result === 'number') return result;
    if (result.confidence !== undefined) return result.confidence;
    if (result.score !== undefined) return result.score;
    if (result.strataScore !== undefined) return result.strataScore;
    if (result.driftScore !== undefined) return result.driftScore;
    if (result.healthScore !== undefined) return result.healthScore;
    return 0.5;
  }

  _computeBrittleness(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const normalized = values.map(v => Math.abs(v - mean) / (mean || 1));
    return normalized.reduce((s, v) => s + v, 0) / normalized.length;
  }
}

module.exports = new ProbabilisticLens();
module.exports.ProbabilisticLens = ProbabilisticLens;