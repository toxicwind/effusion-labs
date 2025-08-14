// lib/build-info.js
import { execSync } from "node:child_process";

function safe(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/**
 * Resolve build metadata without ever throwing:
 * - Prefer CI/env SHAs so we don't need .git in Docker build context
 * - Fall back to git if present
 * - Final fallback to "unknown"
 */
export default function getBuildInfo() {
  let sha =
    process.env.COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    "";

  if (!sha) {
    const hasGit = !!safe("git --version");
    if (hasGit) sha = safe("git rev-parse --short HEAD");
  }
  if (!sha) sha = "unknown";

  return {
    sha,
    short: sha.slice(0, 7),
    builtAt: new Date().toISOString(),
    node: process.version,
  };
}
