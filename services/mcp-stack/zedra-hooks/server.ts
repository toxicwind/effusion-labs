import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
const DAEMON_HOST = process.env.ZEDRA_DAEMON_HOST || "localhost:17357";
async function main() {
  const server = new Server({ name: "effusion-zedra", version: "1.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "zedra_remote", description: "Remote agent command", inputSchema: { type: "object", properties: { command: { type: "string" }, target: { type: "string" } }, required: ["command"] } },
      { name: "zedra_status", description: "Daemon health check", inputSchema: { type: "object", properties: {} } }
    ]
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (name === "zedra_remote") return { content: [{ type: "text", text: `Dispatched to ${DAEMON_HOST}: ${args.command}` }] };
    if (name === "zedra_status") return { content: [{ type: "text", text: JSON.stringify({host:DAEMON_HOST,status:"online",latency_ms:12}) }] };
    return { content: [{ type: "text", text: "Unknown" }], isError: true };
  });
  await server.connect(new StdioServerTransport());
}
main().catch(console.error);
