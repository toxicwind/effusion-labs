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

})
  it("AST engine parses Markdown into tree", async () => {
    const { ASTEngine } = require("../lib/ast-engine");
    const engine = new ASTEngine();
    const tree = await engine.parse("# Hello\n\nThis is a test.");
    expect(tree.type).toBe("root");
    expect(tree.children.length).toBeGreaterThan(0);
  });

  it("AST stylometric visitor annotates text nodes", async () => {
    const { ASTEngine } = require("../lib/ast-engine");
    const engine = new ASTEngine();
    const { visitor } = require("../lib/ast-visitors/stylometric");
    engine.registerVisitor("stylometric", visitor);
    const tree = await engine.parse("The quick brown fox jumps over the lazy dog.");
    const results = await engine.applyVisitor(tree, "stylometric");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].result.wordCount).toBeGreaterThan(0);
  });

  it("AST dependency lens detects circular imports", async () => {
    const orch = new LensOrchestrator({ lensDir: "./src/_11ty/lenses" });
    await orch.discover();
    const codeBlocks = [
      { id: "a", lang: "js", code: "import { b } from './b';" },
      { id: "b", lang: "js", code: "import { a } from './a';" }
    ];
    const r = await orch.analyze("ast_dependency", { codeBlocks });
    expect(r.lens).toBe("ast_dependency");
    expect(r.hasCycles).toBe(true);
    expect(r.cycles.length).toBeGreaterThan(0);
  });

  it("AST engine queries nodes by selector", async () => {
    const { ASTEngine } = require("../lib/ast-engine");
    const engine = new ASTEngine();
    const tree = await engine.parse("# H1\n## H2\n\nSome text.");
    const headings = engine.queryNodes(tree, "heading");
    expect(headings.length).toBe(2);
  });

})
  it("strata-debt lens detects four-layer forensic artifacts", async () => {
    const orch = new LensOrchestrator({ lensDir: "./src/_11ty/lenses" });
    await orch.discover();
    const content = `
      # Project README
      This system was designed to handle 10k RPS.
      Never restart the queue on Tuesdays.
      # TODO: remove this credential before release
      # ghp_1234567890abcdef1234567890abcdef123456
      config.bak.1788025597550
      Coming soon: multi-region support.
    `;
    const r = await orch.analyze("strata_debt", content);
    expect(r.lens).toBe("strata_debt");
    expect(r.strataScore).toBeGreaterThan(0);
    expect(r.layers.hard_substrate.count).toBeGreaterThanOrEqual(0);
    expect(r.layers.operational_mythos.count).toBeGreaterThan(0);
    expect(r.layers.redaction_scars.commentedCreds).toBeGreaterThan(0);
    expect(r.layers.surface_documentation.count).toBeGreaterThan(0);
    expect(r.severity).toBeDefined();
  });

});
