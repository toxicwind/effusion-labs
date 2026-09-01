import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, ListResourcesRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ASTEngine } from "../../lib/ast-engine.js";

const engine = new ASTEngine();

async function main() {
  const server = new Server(
    { name: "effusion-ast", version: "2.1.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "ast_parse", description: "Parse Markdown/MDX into AST", inputSchema: { type: "object", properties: { content: { type: "string" } }, required: ["content"] } },
      { name: "ast_query", description: "Query AST nodes by selector", inputSchema: { type: "object", properties: { tree: { type: "object" }, selector: { type: "string" } }, required: ["tree", "selector"] } },
      { name: "ast_annotate", description: "Apply lens visitor to AST and return annotations", inputSchema: { type: "object", properties: { content: { type: "string" }, visitors: { type: "array", items: { type: "string" } } }, required: ["content"] } },
      { name: "ast_topology", description: "Extract document topology (headings, lists, code blocks)", inputSchema: { type: "object", properties: { content: { type: "string" } }, required: ["content"] } }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (name === "ast_parse") {
      const tree = await engine.parse(args.content);
      return { content: [{ type: "text", text: JSON.stringify(tree, null, 2) }] };
    }
    if (name === "ast_query") {
      const nodes = engine.queryNodes(args.tree, args.selector);
      return { content: [{ type: "text", text: JSON.stringify(nodes, null, 2) }] };
    }
    if (name === "ast_annotate") {
      const visitors = await Promise.all((args.visitors || ["stylometric", "osint", "cryptographic", "semantic"]).map(async v => {
        try {
          const mod = await import(`../../lib/ast-visitors/${v}.js`);
          engine.registerVisitor(mod.name, mod.visitor);
          return mod.name;
        } catch { return null; }
      }));
      const { results, annotations } = await engine.transform(args.content, visitors.filter(Boolean));
      return { content: [{ type: "text", text: JSON.stringify({ results, annotations }, null, 2) }] };
    }
    if (name === "ast_topology") {
      const tree = await engine.parse(args.content);
      const topology = [];
      const { visit } = await import('unist-util-visit');
      visit(tree, (node) => {
        if (node.type === 'heading' || node.type === 'list' || node.type === 'code') {
          topology.push({ type: node.type, depth: node.depth, lang: node.lang, ordered: node.ordered, position: node.position });
        }
      });
      return { content: [{ type: "text", text: JSON.stringify(topology, null, 2) }] };
    }
    return { content: [{ type: "text", text: "Unknown AST tool" }], isError: true };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: "ast://schema", name: "AST Node Schema", mimeType: "application/json" },
      { uri: "ast://visitors", name: "Registered AST Visitors", mimeType: "application/json" }
    ]
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params.uri;
    if (uri === "ast://schema") {
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ nodeTypes: ["root", "paragraph", "heading", "text", "code", "inlineCode", "link", "list", "listItem", "blockquote", "thematicBreak", "html", "table", "tableRow", "tableCell"], version: "2.1.0" }) }] };
    }
    if (uri === "ast://visitors") {
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ visitors: ["stylometric", "osint", "cryptographic", "semantic", "tectonic"] }) }] };
    }
    return { contents: [] };
  });

  await server.connect(new StdioServerTransport());
}

main().catch(console.error);