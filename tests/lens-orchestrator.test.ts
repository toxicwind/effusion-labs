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
});
