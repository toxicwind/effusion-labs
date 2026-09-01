/**
 * Lens: Temporal Drift — Time-series content change detection
 * Compares current content against historical snapshots to detect
 * semantic drift, authorship changes, and structural evolution.
 */

const fs = require('fs').promises;
const path = require('path');

class TemporalDriftLens {
  constructor(opts = {}) {
    this.historyDir = opts.historyDir || process.env.TEMPORAL_HISTORY_DIR || './.temporal-history';
    this.maxSnapshots = opts.maxSnapshots || parseInt(process.env.TEMPORAL_MAX_SNAPSHOTS || '50', 10);
    this.similarityThreshold = opts.similarityThreshold || parseFloat(process.env.TEMPORAL_SIM_THRESHOLD || '0.85');
  }

  async analyze(data, meta = {}) {
    const current = typeof data === 'string' ? data : JSON.stringify(data);
    const path = meta.path || 'unknown';
    const history = await this._loadHistory(path);

    if (history.length === 0) {
      await this._saveSnapshot(path, current);
      return {
        lens: 'temporal_drift',
        status: 'baseline',
        snapshots: 1,
        driftScore: 0.0,
        confidence: 0.99,
        source: path
      };
    }

    const latest = history[history.length - 1];
    const similarity = this._computeSimilarity(current, latest.content);
    const driftScore = 1.0 - similarity;

    const wordChanges = this._detectWordChanges(current, latest.content);
    const structuralChanges = this._detectStructuralChanges(current, latest.content);

    const trend = this._computeTrend(history);
    const volatility = this._computeVolatility(history);

    await this._saveSnapshot(path, current);

    return {
      lens: 'temporal_drift',
      status: driftScore > 0.5 ? 'major_drift' : driftScore > 0.2 ? 'minor_drift' : 'stable',
      snapshots: history.length + 1,
      driftScore: Math.round(driftScore * 1000) / 1000,
      similarity: Math.round(similarity * 1000) / 1000,
      wordChanges: wordChanges.slice(0, 20),
      structuralChanges,
      trend,
      volatility: Math.round(volatility * 1000) / 1000,
      threshold: this.similarityThreshold,
      confidence: 0.91,
      source: path
    };
  }

  _computeSimilarity(a, b) {
    const wordsA = new Set(a.toLowerCase().match(/\b\w+\b/g) || []);
    const wordsB = new Set(b.toLowerCase().match(/\b\w+\b/g) || []);
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size > 0 ? intersection.size / union.size : 1.0;
  }

  _detectWordChanges(current, previous) {
    const curr = new Set(current.toLowerCase().match(/\b\w{4,}\b/g) || []);
    const prev = new Set(previous.toLowerCase().match(/\b\w{4,}\b/g) || []);
    const added = [...curr].filter(w => !prev.has(w));
    const removed = [...prev].filter(w => !curr.has(w));
    return [
      ...added.map(w => ({ word: w, type: 'added' })),
      ...removed.map(w => ({ word: w, type: 'removed' }))
    ];
  }

  _detectStructuralChanges(current, previous) {
    const currHeadings = (current.match(/^#{1,6}\s+.+$/gm) || []).length;
    const prevHeadings = (previous.match(/^#{1,6}\s+.+$/gm) || []).length;
    const currCode = (current.match(/```/g) || []).length / 2;
    const prevCode = (previous.match(/```/g) || []).length / 2;
    const currLinks = (current.match(/\[.+?\]\(.+?\)/g) || []).length;
    const prevLinks = (previous.match(/\[.+?\]\(.+?\)/g) || []).length;

    return {
      headingDelta: currHeadings - prevHeadings,
      codeBlockDelta: currCode - prevCode,
      linkDelta: currLinks - prevLinks,
      lineDelta: current.split('\n').length - previous.split('\n').length
    };
  }

  _computeTrend(history) {
    if (history.length < 3) return 'insufficient_data';
    const similarities = [];
    for (let i = 1; i < history.length; i++) {
      similarities.push(this._computeSimilarity(history[i].content, history[i-1].content));
    }
    const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const first = similarities.slice(0, Math.floor(similarities.length / 2));
    const second = similarities.slice(Math.floor(similarities.length / 2));
    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;
    return secondAvg > firstAvg ? 'converging' : secondAvg < firstAvg ? 'diverging' : 'stable';
  }

  _computeVolatility(history) {
    if (history.length < 2) return 0;
    const similarities = [];
    for (let i = 1; i < history.length; i++) {
      similarities.push(this._computeSimilarity(history[i].content, history[i-1].content));
    }
    const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const variance = similarities.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / similarities.length;
    return Math.sqrt(variance);
  }

  async _loadHistory(filePath) {
    const safePath = filePath.replace(/[^a-zA-Z0-9_-]/g, '_');
    const historyPath = path.join(this.historyDir, `${safePath}.jsonl`);
    try {
      const data = await fs.readFile(historyPath, 'utf-8');
      return data.trim().split('\n').filter(Boolean).map(JSON.parse);
    } catch {
      return [];
    }
  }

  async _saveSnapshot(filePath, content) {
    const safePath = filePath.replace(/[^a-zA-Z0-9_-]/g, '_');
    const historyPath = path.join(this.historyDir, `${safePath}.jsonl`);
    await fs.mkdir(this.historyDir, { recursive: true });
    const snapshot = { timestamp: new Date().toISOString(), content: content.slice(0, 10000) };
    await fs.appendFile(historyPath, JSON.stringify(snapshot) + '\n');

    // Trim old snapshots
    const history = await this._loadHistory(filePath);
    if (history.length > this.maxSnapshots) {
      const trimmed = history.slice(-this.maxSnapshots);
      await fs.writeFile(historyPath, trimmed.map(JSON.stringify).join('\n') + '\n');
    }
  }
}

module.exports = new TemporalDriftLens();
module.exports.TemporalDriftLens = TemporalDriftLens;