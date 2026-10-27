import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Resolve against the server file location, not process.cwd(), so the
// server works no matter where the MCP client spawns it from.
// Overridable via LENS_DIR (resolved against cwd when relative).
const DEFAULT_LENS_DIR = path.resolve(import.meta.dir, "../../../src/_11ty/lenses");
const LENS_DIR = path.resolve(process.env.LENS_DIR || DEFAULT_LENS_DIR);

interface LensResult {
  lens: string;
  confidence: number;
  [key: string]: any;
}

function unwrapLensModule(ns: any): { name?: string; analyze?: Function; description?: string } | null {
  // CJS modules (module.exports = {...}) arrive as namespace.default;
  // pure ESM lenses arrive as the namespace itself.
  const candidates = [ns?.default ?? null, ns];
  for (const mod of candidates) {
    if (mod && typeof mod === "object" && mod.name && typeof mod.analyze === "function") {
      return mod;
    }
  }
  return null;
}

async function loadLenses() {
  const lenses: Map<string, any> = new Map();
  try {
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(LENS_DIR);
    for (const f of files.filter((f: string) => f.startsWith("lens_") && f.endsWith(".js"))) {
      const fileUrl = pathToFileURL(path.join(LENS_DIR, f)).href;
      try {
        const ns = await import(fileUrl);
        const mod = unwrapLensModule(ns);
        if (mod) {
          lenses.set(mod.name as string, mod);
        } else {
          console.error(`[lens-server] Skipped ${f}: no { name, analyze() } contract`);
        }
      } catch (e) {
        console.error(`[lens-server] Failed to import ${f}:`, (e as Error).message);
      }
    }
  } catch (e) {
    console.error("[lens-server] Failed to scan lens dir:", (e as Error).message);
  }
  return lenses;
}

async function main() {
  const lenses = await loadLenses();
  console.error(`[lens-server] Loaded ${lenses.size} lens profiles from ${LENS_DIR}`);

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
    const lensName = name.replace(/_analyze$/, "");
    const lens = lenses.get(lensName);
    if (!lens) {
      return { content: [{ type: "text", text: `Lens "${lensName}" not found` }], isError: true };
    }
    try {
      const result = await lens.analyze((args as any)?.content, (args as any)?.meta || {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Lens "${lensName}" failed: ${(e as Error).message}` }],
        isError: true,
      };
    }
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
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ lenses: Array.from(lenses.keys()), lens_dir: LENS_DIR, version: "2.0.0" }) }],
      };
    }
    if (uri === "lens://profiles") {
      const profiles = Array.from(lenses.entries()).map(([name, lens]) => ({
        name,
        description: lens.description || null,
      }));
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(profiles, null, 2) }] };
    }
    return { contents: [] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[lens-server] Connected via stdio");
}

main().catch((e) => {
  console.error("[lens-server] Fatal:", e);
  process.exit(1);
});
