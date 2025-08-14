// lib/build-info.js (CommonJS; git-preferred with safe fallbacks)
const { execSync } = require('node:child_process');

function safe(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function getBuildInfo() {
  // Prefer git for everything
  const hashShort = safe('git rev-parse --short HEAD');
  const hashFull  = safe('git rev-parse HEAD');
  const branch    = safe('git rev-parse --abbrev-ref HEAD');
  const ts        = safe('git log -1 --format=%ct'); // unix seconds
  const author    = safe('git log -1 --format=%an');
  const subject   = safe('git log -1 --format=%s');
  const dirtyOut  = safe('git status --porcelain');
  const dirty     = !!(dirtyOut && dirtyOut.length);

  // Fallbacks when git is missing (e.g., minimal container)
  const nowIso = new Date().toISOString();
  const dateIso = ts ? new Date(Number(ts) * 1000).toISOString() : nowIso;

  return {
    hash: hashShort || 'unknown',
    fullHash: hashFull || null,
    branch: branch || null,
    author: author || null,
    subject: subject || null,
    date: dateIso,
    dirty,
  };
}

module.exports = { getBuildInfo };
