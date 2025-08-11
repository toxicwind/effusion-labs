#!/usr/bin/env node
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TEST_DIRS = ["test", "tests"];

function collectTests(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTests(full, out);
    else if (/\.(test|spec)\.m?js$/i.test(entry.name)) out.push(full);
  }
}

function listAllTests() {
  const files = [];
  for (const dir of TEST_DIRS) {
    if (fs.existsSync(dir)) collectTests(dir, files);
  }
  return files;
}

function gitChanged() {
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

function relatedTests(changed) {
  const all = listAllTests();
  const set = new Set();
  for (const file of changed) {
    if (/\.(test|spec)\.m?js$/i.test(file)) {
      set.add(file);
      continue;
    }
    const base = path.basename(file).replace(/\.[^.]+$/, "");
    for (const t of all) {
      if (t.includes(base)) set.add(t);
    }
  }
  return Array.from(set);
}

function categorize(files) {
  const pw = [];
  const nodeFiles = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    if (src.includes("@playwright/test")) pw.push(file);
    else nodeFiles.push(file);
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
  const { pw, nodeFiles } = categorize(files);
  const codes = [];
  if (nodeFiles.length) codes.push(await runNode(nodeFiles));
  if (pw.length) codes.push(await runPw(pw));
  process.exit(codes.some((c) => c !== 0) ? 1 : 0);
}

function main() {
  if (process.env.CI) {
    return run([]);
  }
  const cli = process.argv.slice(2);
  if (cli.length) {
    return run(cli);
  }
  const files = relatedTests(gitChanged());
  if (files.length === 0) {
    console.log("No targeted tests found; running full suite");
    return run([]);
  }
  console.log("Running tests:\n" + files.join("\n"));
  return run(files);
}

main();
