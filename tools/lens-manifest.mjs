#!/usr/bin/env bun
/**
 * lens-manifest.mjs — prebuild step for the autonomous knowledge organism.
 *
 * Runs every lens in src/_11ty/lenses over every content source, aggregates
 * per-lens scalar signals through the consensus engine, and emits
 * src/_data/lensManifest.json into the data cascade BEFORE eleventy builds,
 * so templates (and the {% lens %} shortcode) render live analysis.
 *
 * Gated by LENS_ENABLED=true. New code is Bun per estate convention.
 */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dir, "..");

if (process.env.LENS_ENABLED !== "true") {
  console.log("[lens] LENS_ENABLED != 'true' — skipping lens manifest (organism dormant)");
  process.exit(0);
}

// Keep drift snapshots in a gitignored build-artifact dir, never in the tree.
process.env.TEMPORAL_HISTORY_DIR =
  process.env.TEMPORAL_HISTORY_DIR || path.join(ROOT, ".temporal-history");
// Monte Carlo iterations per page for the probabilistic lens (default 100 is build-hostile).
process.env.PROB_ITERATIONS = process.env.PROB_ITERATIONS || "25";

const { LensOrchestrator } = require("../lib/lens-orchestrator.js");
const matter = require("gray-matter");

const t0 = Bun.nanoseconds();

const patterns = ["src/content/**/*.md", "src/pages/**/*.md"];
const files = new Set();
for (const pattern of patterns) {
  const glob = new Bun.Glob(pattern);
  for await (const f of glob.scan({ cwd: ROOT })) files.add(f);
}
const sorted = [...files].sort();
console.log(`[lens] Analyzing ${sorted.length} content files with the lens swarm...`);

const allContent = [];
for (const rel of sorted) {
  const abs = path.join(ROOT, rel);
  try {
    const raw = await fs.readFile(abs, "utf8");
    const { data, content } = matter(raw);
    allContent.push({ content, inputPath: rel, data });
  } catch (e) {
    console.warn(`[lens] Skipped ${rel}: ${e.message}`);
  }
}

const orchestrator = new LensOrchestrator();
await orchestrator.discover();
const manifest = await orchestrator.runBuildPipeline(allContent);

const ms = Number(Bun.nanoseconds() - t0) / 1e6;
const withConsensus = manifest.items.filter((i) =>
  ["unanimous", "dissent", "fractured"].includes(i.lens_results?.consensus?.status)
).length;
console.log(
  `[lens] Manifest: ${manifest.items.length} items, ` +
  `${withConsensus} with consensus quorum, in ${(ms / 1000).toFixed(1)}s`
);
