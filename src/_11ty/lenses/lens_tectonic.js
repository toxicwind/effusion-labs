/**
 * Lens: Tectonic - Polyrepo Drift Detection and Ecosystem Synchronization
 * Analyzes cross-repository dependency alignment, version drift, update cadence,
 * and propagation latency across the toxicwind ecosystem.
 */

const TECTONIC_CONFIG = require('./tectonic-config.json');

function parseDeps(packageJson) {
  if (!packageJson) return {};
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  return deps;
}

function versionDistance(v1, v2) {
  const a = v1.replace(/^[^0-9]/, '').split('.').map(Number);
  const b = v2.replace(/^[^0-9]/, '').split('.').map(Number);
  let dist = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    dist += Math.abs((a[i] || 0) - (b[i] || 0)) * Math.pow(10, 2 - i);
  }
  return dist;
}

module.exports = {
  name: 'tectonic',
  description: 'Polyrepo drift detection and ecosystem synchronization analysis',

  analyze(data, meta = {}) {
    const repos = data.repos || TECTONIC_CONFIG.repos || [];
    const depMatrix = data.depMatrix || {};
    const lastUpdated = data.lastUpdated || {};

    const depDrift = [];
    const depIndex = {};

    for (const [repo, deps] of Object.entries(depMatrix)) {
      for (const [dep, version] of Object.entries(deps)) {
        if (!depIndex[dep]) depIndex[dep] = {};
        depIndex[dep][repo] = version;
      }
    }

    for (const [dep, versions] of Object.entries(depIndex)) {
      const unique = [...new Set(Object.values(versions))];
      if (unique.length > 1) {
        const pairs = [];
        const repoList = Object.entries(versions);
        for (let i = 0; i < repoList.length; i++) {
          for (let j = i + 1; j < repoList.length; j++) {
            pairs.push({
              repoA: repoList[i][0], verA: repoList[i][1],
              repoB: repoList[j][0], verB: repoList[j][1],
              distance: versionDistance(repoList[i][1], repoList[j][1])
            });
          }
        }
        const maxDist = Math.max(...pairs.map(p => p.distance));
        depDrift.push({
          dependency: dep, versions, pairs, maxDistance: maxDist,
          severity: maxDist > 10 ? 'critical' : maxDist > 1 ? 'warning' : 'minor'
        });
      }
    }

    const now = Date.now();
    const cadence = repos.map(repo => {
      const updated = lastUpdated[repo] ? new Date(lastUpdated[repo]).getTime() : 0;
      const daysSince = updated ? (now - updated) / (1000 * 60 * 60 * 24) : Infinity;
      return { repo, daysSince, status: daysSince > 30 ? 'stale' : daysSince > 7 ? 'aging' : 'fresh' };
    });

    const staleRepos = cadence.filter(c => c.status === 'stale');
    const freshRatio = cadence.filter(c => c.status === 'fresh').length / repos.length;

    const driftPenalty = depDrift.filter(d => d.severity === 'critical').length * 15 + depDrift.filter(d => d.severity === 'warning').length * 5;
    const stalePenalty = staleRepos.length * 10;
    const healthScore = Math.max(0, 100 - driftPenalty - stalePenalty + (freshRatio * 10));

    const propagationBlocks = [];
    for (const drift of depDrift) {
      const internal = Object.keys(drift.versions).filter(r => repos.includes(r));
      if (internal.length >= 2) {
        propagationBlocks.push({ dependency: drift.dependency, repos: internal, action: 'sync' });
      }
    }

    return {
      lens: 'tectonic',
      repoCount: repos.length,
      depDrift,
      driftCount: depDrift.length,
      criticalDrift: depDrift.filter(d => d.severity === 'critical').length,
      cadence,
      staleRepos: staleRepos.map(c => c.repo),
      freshRatio: Math.round(freshRatio * 100) / 100,
      propagationBlocks,
      healthScore: Math.round(healthScore),
      confidence: 0.91,
      source: meta.path || 'tectonic-config'
    };
  }
};