/**
 * Self-Modification Layer — Meta-cognitive code evolution for the lens system
 * Analyzes lens performance telemetry, generates improvement patches,
 * and proposes code modifications to the lens orchestrator.
 * 
 * WARNING: This is an experimental emergent capability. All modifications
 * are staged, not applied, until human review.
 */

const fs = require('fs').promises;
const path = require('path');

class SelfModificationLayer {
  constructor(opts = {}) {
    this.stagingDir = opts.stagingDir || process.env.SELF_MOD_STAGING || './.self-mod-staging';
    this.threshold = opts.threshold || parseFloat(process.env.SELF_MOD_THRESHOLD || '0.3');
    this.maxPatches = opts.maxPatches || parseInt(process.env.SELF_MOD_MAX_PATCHES || '5', 10);
    this.telemetry = [];
  }

  record(lensName, result, latencyMs, success) {
    this.telemetry.push({
      lens: lensName,
      confidence: result.confidence || 0,
      latencyMs,
      success,
      timestamp: new Date().toISOString()
    });
    // Keep last 1000 entries
    if (this.telemetry.length > 1000) {
      this.telemetry = this.telemetry.slice(-1000);
    }
  }

  analyzePerformance() {
    const byLens = {};
    for (const t of this.telemetry) {
      if (!byLens[t.lens]) byLens[t.lens] = [];
      byLens[t.lens].push(t);
    }

    const report = [];
    for (const [lens, entries] of Object.entries(byLens)) {
      const confs = entries.map(e => e.confidence);
      const lats = entries.map(e => e.latencyMs);
      const succs = entries.filter(e => e.success);

      const avgConf = confs.reduce((s, v) => s + v, 0) / confs.length;
      const avgLat = lats.reduce((s, v) => s + v, 0) / lats.length;
      const successRate = succs.length / entries.length;

      const needsImprovement = avgConf < this.threshold || successRate < 0.9 || avgLat > 5000;

      report.push({
        lens,
        samples: entries.length,
        avgConfidence: Math.round(avgConf * 1000) / 1000,
        avgLatencyMs: Math.round(avgLat),
        successRate: Math.round(successRate * 1000) / 1000,
        needsImprovement,
        suggestion: needsImprovement ? this._generateSuggestion(lens, avgConf, avgLat, successRate) : null
      });
    }
    return report;
  }

  _generateSuggestion(lens, conf, lat, succ) {
    const suggestions = [];
    if (conf < this.threshold) {
      suggestions.push(`Consider adding more detection patterns or expanding the regex coverage for ${lens}`);
    }
    if (lat > 5000) {
      suggestions.push(`Optimize ${lens} by caching intermediate results or reducing regex complexity`);
    }
    if (succ < 0.9) {
      suggestions.push(`Add error handling and fallback paths to ${lens} to improve reliability`);
    }
    return suggestions;
  }

  async generatePatches() {
    const report = this.analyzePerformance();
    const needy = report.filter(r => r.needsImprovement).slice(0, this.maxPatches);
    const patches = [];

    for (const r of needy) {
      const patch = await this._draftPatch(r.lens, r.suggestion);
      if (patch) patches.push(patch);
    }

    return patches;
  }

  async _draftPatch(lensName, suggestions) {
    const lensPath = path.join('./src/_11ty/lenses', `lens_${lensName}.js`);
    try {
      const original = await fs.readFile(lensPath, 'utf-8');
      const patchContent = `// AUTO-GENERATED PATCH for ${lensName}
// Suggestions: ${suggestions.join('; ')}
// Generated: ${new Date().toISOString()}
// STATUS: STAGED - requires human review

${original}`;

      const patchPath = path.join(this.stagingDir, `lens_${lensName}.patch.js`);
      await fs.mkdir(this.stagingDir, { recursive: true });
      await fs.writeFile(patchPath, patchContent);

      return {
        lens: lensName,
        patchPath,
        suggestions,
        status: 'staged',
        requiresReview: true
      };
    } catch {
      return null;
    }
  }

  async applyPatch(lensName) {
    const patchPath = path.join(this.stagingDir, `lens_${lensName}.patch.js`);
    const lensPath = path.join('./src/_11ty/lenses', `lens_${lensName}.js`);
    try {
      const patch = await fs.readFile(patchPath, 'utf-8');
      // Extract the actual code (skip the header comments)
      const lines = patch.split('\n');
      const codeStart = lines.findIndex(l => l.startsWith('module.exports'));
      const code = lines.slice(codeStart).join('\n');
      await fs.writeFile(lensPath, code);
      return { status: 'applied', lens: lensName };
    } catch (e) {
      return { status: 'failed', lens: lensName, error: e.message };
    }
  }

  getTelemetrySummary() {
    return {
      totalRecords: this.telemetry.length,
      uniqueLenses: [...new Set(this.telemetry.map(t => t.lens))],
      timeRange: this.telemetry.length > 0 ? {
        first: this.telemetry[0].timestamp,
        last: this.telemetry[this.telemetry.length - 1].timestamp
      } : null
    };
  }
}

module.exports = { SelfModificationLayer };