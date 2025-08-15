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
import { canRunBrowser } from "./shared/probe-browser.mjs";

const TEST_DIRS = ["test", "tests"];
const TEST_RE = /\.(test|spec)\.(?:m?js|[cm]?ts)$/i; // js, mjs, cjs, ts, mts, cts
const LEDGER_PATH = path.resolve("tools/test-ledger.json");

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

function readLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
  } catch {
    return {};
  }
}

function inferCaps(file) {
  const caps = [];
  if (/\.browser\./i.test(file)) caps.push("browser");
  return caps;
}

function categorize(files, ledger) {
  const browser = [];
  const nodeFiles = [];
  for (const file of files) {
    const entry = ledger[file] || {};
    const caps = entry.caps || inferCaps(file);
    if (caps.includes("browser")) browser.push(file);
    else nodeFiles.push(file);
  }
  return { browser, nodeFiles };
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
  const targets = files.length === 0 ? listAllTests() : files;
  const ledger = readLedger();
  const { browser, nodeFiles } = categorize(targets, ledger);
  const canBrowser = await canRunBrowser();

  const parked = [];
  let executed = 0;
  const jobs = [];

  if (nodeFiles.length) {
    executed += nodeFiles.length;
    jobs.push(runNode(nodeFiles));
  }

  if (browser.length) {
    if (canBrowser) {
      executed += browser.length;
      jobs.push(runPw(browser));
    } else {
      parked.push(...browser);
    }
  }

  const codes = jobs.length ? await Promise.all(jobs) : [0];
  const exitCode = codes.some((c) => c !== 0) ? 1 : 0;
  printSummary(canBrowser, executed, parked);
  process.exit(exitCode);
}

function printSummary(canBrowser, executed, parked) {
  console.log("Browser capability:", canBrowser ? "available" : "unavailable");
  console.log(`Executed specs: ${executed}`);
  if (parked.length) {
    console.log(`Parked specs: ${parked.length}`);
    parked.forEach((f) => console.log(`- ${f}`));
  } else {
    console.log("Parked specs: none");
  }
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
