import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
async function selectModel(task, hw) {
  const models = [{id:"gpt-4o",ctx:128000,spd:"fast"},{id:"claude-3-5-sonnet",ctx:200000,spd:"medium"},{id:"gemini-1.5-pro",ctx:2000000,spd:"fast"}];
  return models.sort((a,b)=>b.ctx-a.ctx)[0];
}
async function main() {
  const server = new Server({ name: "effusion-modelbeats", version: "1.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{ name: "modelbeats_select", description: "Select optimal LLM", inputSchema: { type: "object", properties: { task: { type: "string" }, hardwareProfile: { type: "string" } }, required: ["task"] } }]
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (name === "modelbeats_select") {
      const m = await selectModel(args.task, args.hardwareProfile||"any");
      return { content: [{ type: "text", text: JSON.stringify(m) }] };
    }
    return { content: [{ type: "text", text: "Unknown" }], isError: true };
  });
  await server.connect(new StdioServerTransport());
}
main().catch(console.error);
