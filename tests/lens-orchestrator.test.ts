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

})
  it("vector pipeline embeds text into 384-dim vector", async () => {
    const { VectorPipeline } = require("../lib/vector-pipeline");
    const pipe = new VectorPipeline({ dimension: 384 });
    const vec = await pipe.embed("The quick brown fox jumps over the lazy dog.");
    expect(vec.length).toBe(384);
    expect(vec.some(v => v !== 0.0)).toBe(true);
  });

  it("knowledge graph builds from OSINT results", async () => {
    const { KnowledgeGraph } = require("../lib/knowledge-graph");
    const kg = new KnowledgeGraph();
    const osint = { urls_found: ["https://effusionlabs.com"], emails_found: ["test@example.com"], ips_found: [], domains_found: ["effusionlabs.com"] };
    kg.fromOSINT(osint, { path: "/test.md" });
    expect(kg.nodes.size).toBeGreaterThan(0);
    expect(kg.edges.length).toBeGreaterThan(0);
    const json = kg.toJSON();
    expect(json.stats.nodeCount).toBeGreaterThan(0);
  });

  it("knowledge graph detects cycles in dependency data", async () => {
    const { KnowledgeGraph } = require("../lib/knowledge-graph");
    const kg = new KnowledgeGraph();
    const deps = { dependencyGraph: { a: ["b"], b: ["a"] }, cycles: ["a -> b -> a"] };
    kg.fromDependencies(deps, { path: "/test.md" });
    const cycleNodes = Array.from(kg.nodes.values()).filter(n => n.label === 'Cycle');
    expect(cycleNodes.length).toBe(1);
  });

  it("sync layer tracks client subscriptions", async () => {
    const { SyncLayer } = require("../lib/sync-layer");
    const sync = new SyncLayer({ port: 17359 });
    // We cannot start the server in test without ws, but we verify structure
    expect(sync.port).toBe(17359);
    expect(sync.clients).toBeDefined();
  });

})
  it("consensus engine detects outliers in multi-agent results", async () => {
    const { ConsensusEngine } = require("../lib/consensus-engine");
    const engine = new ConsensusEngine({ quorumRatio: 0.67, outlierThreshold: 2.0 });
    const results = [
      { confidence: 0.9 }, { confidence: 0.88 }, { confidence: 0.91 },
      { confidence: 0.87 }, { confidence: 0.3 }
    ];
    const r = await engine.analyze({ results }, {});
    expect(r.lens).toBe("consensus");
    expect(r.outlierCount).toBeGreaterThan(0);
    expect(r.status).toBe("dissent");
    expect(r.quorumConfidence).toBeGreaterThan(0.5);
  });

  it("self-modification layer records telemetry and generates suggestions", async () => {
    const { SelfModificationLayer } = require("../lib/self-modification");
    const mod = new SelfModificationLayer({ threshold: 0.5 });
    mod.record("stylometric", { confidence: 0.3 }, 100, true);
    mod.record("stylometric", { confidence: 0.25 }, 120, true);
    mod.record("cryptographic", { confidence: 0.95 }, 50, true);
    const report = mod.analyzePerformance();
    expect(report.length).toBeGreaterThan(0);
    const needy = report.filter(r => r.needsImprovement);
    expect(needy.length).toBeGreaterThan(0);
  });

  it("quantum superposition lens collapses multi-state probabilities", async () => {
    const lens = require("../src/_11ty/lenses/lens_quantum_superposition");
    const text = "This API endpoint returns a JSON object with parameters and types. The vulnerability was patched in CVE-2026-1234.";
    const r = await lens.analyze(text, {});
    expect(r.lens).toBe("quantum_superposition");
    expect(r.states.length).toBeGreaterThan(0);
    expect(r.dominantState).toBeDefined();
    expect(r.coherence).toBeGreaterThan(0);
    expect(r.entropy).toBeGreaterThan(0);
  });

});
