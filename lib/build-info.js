// lib/build-info.js
const { execSync } = require("node:child_process");

function tryGit(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function getBuildInfo() {
  // Fast path: CI/registry-provided SHAs (no subprocess)
  let sha =
    process.env.COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    "";

  // Local dev (non-CI) can fall back to git if present
  if (!sha && !process.env.CI) {
    if (tryGit("git --version")) sha = tryGit("git rev-parse --short HEAD");
  }

  if (!sha) sha = "unknown";

  return {
    sha,
    short: sha.slice(0, 7),
    builtAt: new Date().toISOString(),
    node: process.version,
  };
}

module.exports = getBuildInfo;
