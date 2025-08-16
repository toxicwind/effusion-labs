import fs from 'node:fs';
import { execSync } from 'node:child_process';

function gitGlob(pattern) {
  try {
    return execSync(`git ls-files ':(glob)${pattern}'`, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function inferCaps(file) {
  return file.includes('/browser/') ? { browser: true } : {};
}

export default async function select({ all = false } = {}) {
  const patterns = [
    'test/unit/**/*.test.mjs',
    'test/unit/**/*.spec.mjs',
    'test/integration/**/*.test.mjs',
    'test/integration/**/*.spec.mjs',
    'test/browser/**/*.test.mjs',
    'test/browser/**/*.spec.mjs',
  ];
  const files = patterns.flatMap(gitGlob);

  let ledger = {};
  if (fs.existsSync('tools/test-ledger.json')) {
    ledger = JSON.parse(fs.readFileSync('tools/test-ledger.json', 'utf8'));
  }

  let entries = files.map(f => ({ file: f, caps: { ...inferCaps(f), ...(ledger[f] || {}) } }));

  if (!all) {
    const changed = execSync('git diff --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const subset = entries.filter(e => changed.includes(e.file));
    if (subset.length) entries = subset;
  }

  return entries;
}
