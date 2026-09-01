/**
 * Lens: Quantum Superposition — Probabilistic multi-state content analysis
 * Treats each content item as existing in multiple semantic states simultaneously.
 * Uses amplitude amplification to boost signal detection in noisy documents.
 */

class QuantumLens {
  constructor(opts = {}) {
    this.dimensions = opts.dimensions || parseInt(process.env.QUANTUM_DIMS || '8', 10);
    this.amplitudeBoost = opts.amplitudeBoost || parseFloat(process.env.QUANTUM_BOOST || '2.0');
    this.collapseThreshold = opts.collapseThreshold || parseFloat(process.env.QUANTUM_COLLAPSE || '0.7');
  }

  async analyze(data, meta = {}) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const states = this._generateSuperpositionStates(text);
    const amplitudes = states.map(s => this._computeAmplitude(s, text));
    const boosted = amplitudes.map(a => a * this.amplitudeBoost);
    const collapsed = this._collapseStates(states, boosted);

    const dominantState = collapsed.sort((a, b) => b.probability - a.probability)[0];
    const entropy = this._computeEntropy(collapsed);
    const coherence = this._computeCoherence(collapsed);

    return {
      lens: 'quantum_superposition',
      dimensions: this.dimensions,
      states: collapsed.slice(0, 5),
      dominantState: dominantState?.label,
      dominantProbability: Math.round((dominantState?.probability || 0) * 1000) / 1000,
      entropy: Math.round(entropy * 1000) / 1000,
      coherence: Math.round(coherence * 1000) / 1000,
      amplitudeBoost: this.amplitudeBoost,
      status: coherence > 0.8 ? 'coherent' : coherence > 0.5 ? 'decoherent' : 'entangled',
      confidence: Math.round(coherence * 0.95 * 1000) / 1000,
      source: meta.path || 'unknown'
    };
  }

  _generateSuperpositionStates(text) {
    const states = [
      { label: 'technical_documentation', keywords: ['api', 'endpoint', 'function', 'parameter', 'return', 'type'] },
      { label: 'narrative_prose', keywords: ['story', 'character', 'scene', 'dialogue', 'narrator', 'plot'] },
      { label: 'security_advisory', keywords: ['vulnerability', 'exploit', 'cve', 'patch', 'severity', 'attack'] },
      { label: 'academic_paper', keywords: ['abstract', 'introduction', 'methodology', 'results', 'conclusion', 'references'] },
      { label: 'configuration', keywords: ['config', 'setting', 'flag', 'enable', 'disable', 'default'] },
      { label: 'incident_report', keywords: ['incident', 'postmortem', 'root cause', 'timeline', 'remediation', 'lessons'] },
      { label: 'competitive_analysis', keywords: ['competitor', 'market', 'advantage', 'moat', 'landscape', 'positioning'] },
      { label: 'agentic_manifesto', keywords: ['autonomous', 'lens', 'swarm', 'mcp', 'perception', 'organism'] }
    ];
    return states;
  }

  _computeAmplitude(state, text) {
    const lower = text.toLowerCase();
    let matches = 0;
    for (const kw of state.keywords) {
      if (lower.includes(kw)) matches++;
    }
    return matches / state.keywords.length;
  }

  _collapseStates(states, amplitudes) {
    const total = amplitudes.reduce((s, a) => s + a, 0) || 1;
    return states.map((s, i) => ({
      label: s.label,
      probability: amplitudes[i] / total,
      amplitude: amplitudes[i],
      keywords: s.keywords.filter(kw => text.toLowerCase().includes(kw))
    }));
  }

  _computeEntropy(states) {
    return -states.reduce((sum, s) => {
      const p = s.probability;
      return sum + (p > 0 ? p * Math.log2(p) : 0);
    }, 0);
  }

  _computeCoherence(states) {
    const probs = states.map(s => s.probability);
    const max = Math.max(...probs);
    return max;
  }
}

module.exports = new QuantumLens();
module.exports.QuantumLens = QuantumLens;