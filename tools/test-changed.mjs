#!/usr/bin/env node
/**
 * Unified test runner for Node's built-in test runner and Playwright.
 * - Discovers tests under ./test and ./tests
 * - Targets only related tests when files changed (git), otherwise runs full suite
 * - Splits Node vs Playwright by sniffing for "@playwright/test"
 * - Supports passing files/dirs via CLI
 */

import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TEST_DIRS = ["test", "tests"];
const TEST_RE = /\.(test|spec)\.(?:m?js|[cm]?ts)$/i; // js, mjs, cjs, ts, mts, cts
const PW_HINT_RE = /(?:^|\s|["'])@playwright\/test(?:["'\s]|$)/; // quick sniff
const SNIFF_BYTES = 8192; // read up to 8KB when categorizing

function collectTests(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTests(full, out);
    } else if (TEST_RE.test(entry.name)) {
      out.push(full);
    }
  }
}

function listAllTests(dirs = TEST_DIRS) {
  const files = [];
  for (const dir of dirs) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      collectTests(dir, files);
    }
  }
  return files;
}

function gitChanged() {
  // Prefer a clean diff-based list (added, copied, modified, renamed)
  try {
    const out = execSync("git diff --name-only --diff-filter=ACMR HEAD", { encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    // Fallback to porcelain if diff fails (e.g., no commits yet)
    try {
      const out = execSync("git status --porcelain", { encoding: "utf8" });
      return out
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => l.slice(3));
    } catch {
      return [];
    }
  }
}

function relatedTests(changed) {
  const all = listAllTests();
  if (changed.length === 0) return [];

  const byBasename = new Map();
  for (const t of all) {
    const base = path.basename(t).replace(/\.[^.]+$/, ""); // strip ext
    const list = byBasename.get(base) || [];
    list.push(t);
    byBasename.set(base, list);
  }

  const set = new Set();
  for (const file of changed) {
    // If a changed file is itself a test, include it directly
    if (TEST_RE.test(file)) {
      set.add(file);
      continue;
    }
    // Heuristic: match tests whose basename includes the changed file's basename
    const base = path.basename(file).replace(/\.[^.]+$/, "");
    for (const t of all) {
      if (t.includes(base)) set.add(t);
    }
    // Exact basename matches (handles src/foo.ts <-> foo.test.ts)
    const exact = byBasename.get(base);
    if (exact) exact.forEach((t) => set.add(t));
  }

  return Array.from(set);
}

function sniffIsPlaywrightTest(file) {
  // Read a small prefix of the file for sniffing hints to avoid full reads
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.allocUnsafe(SNIFF_BYTES);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    const chunk = buf.slice(0, bytes).toString("utf8");
    return PW_HINT_RE.test(chunk);
  } catch {
    // On read error, fallback to full read (rare)
    try {
      const src = fs.readFileSync(file, "utf8");
      return PW_HINT_RE.test(src);
    } catch {
      return false;
    }
  } finally {
    fs.closeSync(fd);
  }
}

function categorize(files) {
  const pw = [];
  const nodeFiles = [];
  for (const file of files) {
    try {
      if (sniffIsPlaywrightTest(file)) pw.push(file);
      else nodeFiles.push(file);
    } catch {
      // If any issue, default to Node runner to avoid skipping tests
      nodeFiles.push(file);
    }
  }
  return { pw, nodeFiles };
}

function runNode(files) {
  return new Promise((resolve) => {
    const args = ["--test", ...files];
    const proc = spawn("node", args, { stdio: "inherit" });
    proc.on("exit", (code) => resolve(code ?? 1));
  });
}

function runPw(files) {
  return new Promise((resolve) => {
    const args = ["playwright", "test", ...files];
    const proc = spawn("npx", args, { stdio: "inherit" });
    proc.on("exit", (code) => resolve(code ?? 1));
  });
}

async function run(files) {
  // If specific files were passed, use them; otherwise, discover all tests
  const targets = files.length === 0 ? listAllTests() : files;

  // Split into Node runner vs Playwright
  const { pw, nodeFiles } = categorize(targets);

  // Run both in parallel for speed; aggregate exit codes
  const jobs = [];
  if (nodeFiles.length) jobs.push(runNode(nodeFiles));
  if (pw.length) jobs.push(runPw(pw));

  const codes = jobs.length ? await Promise.all(jobs) : [0];
  process.exit(codes.some((c) => c !== 0) ? 1 : 0);
}

function expandInputs(items) {
  // Expand CLI args: files or directories (no globbing)
  const out = [];
  for (const item of items) {
    const p = path.resolve(item);
    if (!fs.existsSync(p)) continue;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      collectTests(p, out);
    } else if (stat.isFile()) {
      if (TEST_RE.test(p)) out.push(p);
    }
  }
  // De-dupe and sort for stable output
  return Array.from(new Set(out)).sort();
}

function main() {
  if (process.env.CI) {
    // In CI, always run full suite
    return run([]);
  }

  const cli = process.argv.slice(2);

  // If CLI args provided, expand and run those
  if (cli.length) {
    const expanded = expandInputs(cli);
    if (expanded.length === 0) {
      console.log("No matching test files from CLI input; running full suite");
      return run([]);
    }
    console.log("Running tests (CLI):\n" + expanded.join("\n"));
    return run(expanded);
  }

  // Otherwise, target tests related to changed files
  const files = relatedTests(gitChanged());
  if (files.length === 0) {
    console.log("No targeted tests found; running full suite");
    return run([]);
  }

  console.log("Running tests (related to changes):\n" + files.join("\n"));
  return run(files);
}

main();
