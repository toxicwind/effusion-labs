/**
 * Subagent Registry — Dynamic discovery and lifecycle management for swarm subagents
 * Discovers lens modules, registers them as subagent templates, and manages
 * agent identity, telemetry, and result routing.
 */

const fs = require('fs').promises;
const path = require('path');

class SubagentRegistry {
  constructor(opts = {}) {
    this.lensDir = opts.lensDir || './src/_11ty/lenses';
    this.visitorDir = opts.visitorDir || './lib/ast-visitors';
    this.agents = new Map();
    this.telemetry = new Map();
  }

  async discoverAll() {
    const lensAgents = await this._discoverLenses();
    const visitorAgents = await this._discoverVisitors();
    const all = [...lensAgents, ...visitorAgents];
    for (const agent of all) {
      this.agents.set(agent.id, agent);
    }
    return all;
  }

  async _discoverLenses() {
    const entries = await fs.readdir(this.lensDir).catch(() => []);
    return entries
      .filter(f => f.startsWith('lens_') && f.endsWith('.js'))
      .map(f => {
        const name = f.replace(/^lens_/, '').replace(/\.js$/, '');
        return {
          id: `lens-${name}`,
          type: 'lens',
          name,
          modulePath: path.join(this.lensDir, f),
          capabilities: ['analyze', 'detect', 'report'],
          maxConcurrency: 1
        };
      });
  }

  async _discoverVisitors() {
    const entries = await fs.readdir(this.visitorDir).catch(() => []);
    return entries
      .filter(f => f.endsWith('.js'))
      .map(f => {
        const name = f.replace(/\.js$/, '');
        return {
          id: `visitor-${name}`,
          type: 'visitor',
          name,
          modulePath: path.join(this.visitorDir, f),
          capabilities: ['traverse', 'annotate', 'extract'],
          maxConcurrency: 4
        };
      });
  }

  getAgent(id) {
    return this.agents.get(id);
  }

  getAgentsByCapability(cap) {
    return Array.from(this.agents.values()).filter(a => a.capabilities.includes(cap));
  }

  getAgentsByType(type) {
    return Array.from(this.agents.values()).filter(a => a.type === type);
  }

  recordTelemetry(agentId, event, data) {
    if (!this.telemetry.has(agentId)) {
      this.telemetry.set(agentId, []);
    }
    this.telemetry.get(agentId).push({
      timestamp: new Date().toISOString(),
      event,
      data
    });
  }

  getTelemetry(agentId) {
    return this.telemetry.get(agentId) || [];
  }

  getAllTelemetry() {
    return Object.fromEntries(this.telemetry);
  }
}

module.exports = { SubagentRegistry };