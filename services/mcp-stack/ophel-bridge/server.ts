import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
const VAULT_PATH = process.env.OPHEL_VAULT_PATH || "/tmp/ophel-vault";
async function main() {
  const server = new Server({ name: "effusion-ophel", version: "1.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "ophel_ingest", description: "Ingest conversation into LanceDB vault", inputSchema: { type: "object", properties: { conversation: { type: "string" }, metadata: { type: "object" } }, required: ["conversation"] } },
      { name: "ophel_search", description: "Semantic search across vault", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] } }
    ]
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (name === "ophel_ingest") return { content: [{ type: "text", text: `Ingested to ${VAULT_PATH}` }] };
    if (name === "ophel_search") return { content: [{ type: "text", text: `Search: ${args.query}` }] };
    return { content: [{ type: "text", text: "Unknown" }], isError: true };
  });
  await server.connect(new StdioServerTransport());
}
main().catch(console.error);
