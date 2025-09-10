// lib/build-info.js
// A simple, synchronous utility to get build information without relying on Git.

export function getBuildInfo() {
  const date = new Date();
  const isCI = process.env.GITHUB_ACTIONS === 'true';

  return {
    // In CI, the commit hash is free. Locally, we don't need it.
    hash: isCI ? (process.env.GITHUB_SHA || 'ci-build').substring(0, 7) : 'local',
    fullHash: isCI ? process.env.GITHUB_SHA : null,
    branch: isCI ? process.env.GITHUB_REF_NAME : null,

    // Author/subject are omitted for speed and simplicity.
    author: null,
    subject: null,

    // The date is always the current build time, which is more relevant for a static site.
    date: date,
    iso: date.toISOString(),

    // The 'dirty' flag is irrelevant without Git. CI is always clean.
    dirty: false,
    
    // The environment of the build.
    env: process.env.ELEVENTY_ENV || (isCI ? 'production' : 'development'),
  };
}

export default { getBuildInfo };