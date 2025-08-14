// lib/build-info.js
const { execSync } = require('node:child_process');

function git(cmd) {
  return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function maybe(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

function getBuildInfo() {
  // Core (back-compat)
  const short = git('rev-parse --short=7 HEAD');
  const ct = Number(git('log -1 --format=%ct')) * 1000;
  const date = new Date(ct);               // keep your original `date` field
  const hash = short;                      // keep your original `hash` field

  // Rich metadata
  const full = maybe(() => git('rev-parse HEAD'), hash);
  const branch = maybe(() => git('rev-parse --abbrev-ref HEAD'), 'detached');
  const tag = maybe(() => git('describe --tags --abbrev=0'), null);
  const describe = maybe(() => git('describe --tags --dirty --always'), full.slice(0, 12));
  const commits = maybe(() => Number(git('rev-list --count HEAD')), null);
  const status = maybe(() => git('status --porcelain'), '');
  const dirty = status.length > 0;

  const subject = maybe(() => git('log -1 --pretty=%s'), '');
  const body = maybe(() => git('log -1 --pretty=%b'), '');
  const authorName = maybe(() => git('log -1 --pretty=%an'), '');
  const authorEmail = maybe(() => git('log -1 --pretty=%ae'), '');
  const committerName = maybe(() => git('log -1 --pretty=%cn'), '');
  const committerEmail = maybe(() => git('log -1 --pretty=%ce'), '');
  const remote = maybe(() => git('remote get-url origin'), null);

  return {
    // Back-compat fields:
    hash,
    date,

    // Expanded:
    hashFull: full,
    branch,
    tag,
    describe,
    dirty,
    counts: { commits },
    commit: {
      subject,
      body,
      author: { name: authorName, email: authorEmail },
      committer: { name: committerName, email: committerEmail },
      atUnix: Math.floor(ct / 1000),
      atIso: new Date(ct).toISOString(),
    },
    remote,
    builtAtIso: new Date().toISOString(),
  };
}

module.exports = { getBuildInfo };
