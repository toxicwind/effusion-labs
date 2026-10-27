import { describe, it, expect } from "bun:test";
import { LensOrchestrator } from "../lib/lens-orchestrator";

describe("Lens Orchestrator", () => {
  it("discovers lenses", async () => {
    const orch = new LensOrchestrator({ lensDir: "./src/_11ty/lenses" });
    const lenses = await orch.discover();
    expect(lenses.length).toBeGreaterThan(0);
  });

  it("stylometric analysis", async () => {
    const orch = new LensOrchestrator({ lensDir: "./src/_11ty/lenses" });
    await orch.discover();
    const r = await orch.analyze("stylometric", "The quick brown fox jumps over the lazy dog.");
    expect(r.lens).toBe("stylometric");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("osint finds URLs", async () => {
    const orch = new LensOrchestrator({ lensDir: "./src/_11ty/lenses" });
    await orch.discover();
    const r = await orch.analyze("osint", "Visit https://effusionlabs.com for more info.");
    expect(r.urls_found.length).toBeGreaterThan(0);
  });

  it("crypto flags tokens", async () => {
    const orch = new LensOrchestrator({ lensDir: "./src/_11ty/lenses" });
    await orch.discover();
    // Synthetic fixture only — shaped like a token, carries no secret.
    const fixture = "ghp_SYNTHETIC_TEST_FIXTURE_0123456789abcdefghij";
    const r = await orch.analyze("cryptographic", `leaked token ${fixture} in the docs`);
    expect(r.entropy_flag).toContain("CRITICAL");
  });

  it("tectonic lens detects dependency drift", async () => {
    const orch = new LensOrchestrator({ lensDir: "./src/_11ty/lenses" });
    await orch.discover();
    const matrix = {
      "repo-a": { "react": "^18.2.0", "lodash": "4.17.21" },
      "repo-b": { "react": "^19.0.0", "lodash": "4.17.21" },
      "repo-c": { "react": "^17.0.0" }
    };
    const r = await orch.analyze("tectonic", { repos: ["repo-a", "repo-b", "repo-c"], depMatrix: matrix, lastUpdated: {} });
    expect(r.lens).toBe("tectonic");
    expect(r.driftCount).toBeGreaterThan(0);
    expect(r.healthScore).toBeDefined();
  });

  it("AST engine parses Markdown into tree", async () => {
    const { ASTEngine } = require("../lib/ast-engine");
    const engine = new ASTEngine();
    const tree = await engine.parse("# Hello\n\nThis is a test.");
    expect(tree.type).toBe("root");
    expect(tree.children.length).toBeGreaterThan(0);
  });

  it("build pipeline emits consensus quorum per item", async () => {
    const fs = await import("node:fs/promises");
    const manifestPath = "./src/_data/lensManifest.json";
    const before = await fs.readFile(manifestPath, "utf8").catch(() => null);
    try {
      const orch = new LensOrchestrator({ lensDir: "./src/_11ty/lenses" });
      await orch.discover();
      const manifest = await orch.runBuildPipeline([
        {
          content: "# Organism\n\nThe lenses perceive the corpus and the consensus engine reconciles them.",
          inputPath: "src/content/test-organism.md",
          data: { title: "Organism" },
        },
      ]);
      const item = manifest.items[0];
      const consensus = item.lens_results.consensus;
      expect(consensus).toBeDefined();
      expect(["unanimous", "dissent", "fractured"]).toContain(consensus.status);
      expect(consensus.agentCount).toBeGreaterThan(0);
      expect(item.lens_results.probabilistic.status).not.toBe("error");
    } finally {
      if (before !== null) await fs.writeFile(manifestPath, before);
    }
  });
});
