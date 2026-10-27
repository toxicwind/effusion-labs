import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { SwarmOrchestrator } from "../../lib/swarm-orchestrator.js";
import { SubagentRegistry } from "../../lib/subagent-registry.js";

const CONCURRENCY = parseInt(process.env.SWARM_MAX_CONCURRENCY || "18", 10);
const swarm = new SwarmOrchestrator({ concurrency: CONCURRENCY });
const registry = new SubagentRegistry();

async function loadLenses() {
  const lenses = new Map();
  try {
    const files = await import("node:fs").then(fs => fs.readdirSync("./src/_11ty/lenses"));
    for (const f of files.filter(f => f.startsWith("lens_") && f.endsWith(".js"))) {
      const mod = await import(`../../src/_11ty/lenses/${f}`);
      if (mod.name && typeof mod.analyze === "function") {
        lenses.set(mod.name, mod);
      }
    }
  } catch (e) { console.error("[swarm-mcp] lens load error:", e); }
  return lenses;
}

async function main() {
  const lenses = await loadLenses();
  await registry.discoverAll();

  const server = new Server(
    { name: "effusion-swarm", version: "2.2.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "swarm_fanout", description: "Run all lenses on single content (18+ concurrent)", inputSchema: { type: "object", properties: { content: { type: "string" }, meta: { type: "object" } }, required: ["content"] } },
      { name: "swarm_fanin", description: "Run one lens on multiple contents (18+ concurrent)", inputSchema: { type: "object", properties: { contents: { type: "array", items: { type: "string" } }, lens: { type: "string" }, meta: { type: "object" } }, required: ["contents", "lens"] } },
      { name: "swarm_dag", description: "Execute DAG of dependent lens nodes", inputSchema: { type: "object", properties: { nodes: { type: "array" }, edges: { type: "array" } }, required: ["nodes"] } },
      { name: "swarm_telemetry", description: "Get subagent execution telemetry", inputSchema: { type: "object", properties: { agentId: { type: "string" } } } },
      { name: "swarm_registry", description: "List all registered subagents", inputSchema: { type: "object", properties: {} } }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (name === "swarm_fanout") {
      const lensArray = Array.from(lenses.values());
      const result = await swarm.executeWithFanOut(args.content, lensArray, args.meta || {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "swarm_fanin") {
      const lens = lenses.get(args.lens);
      if (!lens) return { content: [{ type: "text", text: "Lens not found" }], isError: true };
      const result = await swarm.executeWithFanIn(args.contents, lens, args.meta || {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "swarm_dag") {
      const nodes = args.nodes.map(n => ({ ...n, lensModule: lenses.get(n.lens) }));
      const result = await swarm.executeDAG({ nodes, edges: args.edges || [] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "swarm_telemetry") {
      const tel = registry.getTelemetry(args.agentId);
      return { content: [{ type: "text", text: JSON.stringify(tel, null, 2) }] };
    }
    if (name === "swarm_registry") {
      const agents = Array.from(registry.agents.values());
      return { content: [{ type: "text", text: JSON.stringify(agents, null, 2) }] };
    }
    return { content: [{ type: "text", text: "Unknown swarm tool" }], isError: true };
  });

  await server.connect(new StdioServerTransport());
}

main().catch(console.error);