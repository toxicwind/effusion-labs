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
    const r = await orch.analyze("cryptographic", "ghp_1234567890abcdef1234567890abcdef123456");
    expect(r.entropy_flag).toContain("CRITICAL");
  });
})
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

});
