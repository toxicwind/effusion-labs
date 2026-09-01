import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const LENS_DIR = process.env.LENS_DIR || "./src/_11ty/lenses";

interface LensResult {
  lens: string;
  confidence: number;
  [key: string]: any;
}

async function loadLenses() {
  // Dynamic import of lens modules
  const lenses: Map<string, any> = new Map();
  try {
    const files = await import("node:fs").then(fs => fs.readdirSync(LENS_DIR));
    for (const f of files.filter((f: string) => f.startsWith("lens_") && f.endsWith(".js"))) {
      const mod = await import(`${LENS_DIR}/${f}`);
      if (mod.name && typeof mod.analyze === "function") {
        lenses.set(mod.name, mod);
      }
    }
  } catch (e) {
    console.error("[lens-server] Failed to load lenses:", e);
  }
  return lenses;
}

async function main() {
  const lenses = await loadLenses();
  console.error(`[lens-server] Loaded ${lenses.size} lens profiles`);

  const server = new Server(
    { name: "effusion-lenses", version: "2.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Array.from(lenses.entries()).map(([name, lens]) => ({
      name: `${name}_analyze`,
      description: lens.description || `Analyze content with the ${name} lens`,
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Content to analyze" },
          meta: { type: "object", description: "Optional metadata (path, tags, title)" },
        },
        required: ["content"],
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const lensName = name.replace("_analyze", "");
    const lens = lenses.get(lensName);
    if (!lens) {
      return { content: [{ type: "text", text: `Lens "${lensName}" not found` }], isError: true };
    }
    const result = await lens.analyze(args.content, args.meta || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: "lens://manifest", name: "Lens Manifest", mimeType: "application/json" },
      { uri: "lens://profiles", name: "Available Lens Profiles", mimeType: "application/json" },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params.uri;
    if (uri === "lens://manifest") {
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ lenses: Array.from(lenses.keys()), version: "2.0.0" }) }],
      };
    }
    if (uri === "lens://profiles") {
      const profiles = Array.from(lenses.entries()).map(([name, lens]) => ({
        name,
        description: lens.description,
      }));
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(profiles, null, 2) }] };
    }
    return { contents: [] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[lens-server] Connected via stdio");
}

main().catch(console.error);
