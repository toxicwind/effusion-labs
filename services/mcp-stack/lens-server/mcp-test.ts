// MCP stdio test client for the effusion lens-server. Run with bun.
import { spawn } from "node:child_process";

const serverPath = process.argv[2] || "server.ts";
const child = spawn("bun", ["run", serverPath], {
  cwd: new URL(".", import.meta.url).pathname,
  stdio: ["pipe", "pipe", "pipe"],
});

let buf = "";
let nextId = 1;
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch { /* partial */ }
  }
});
child.stderr.on("data", (d) => process.stderr.write("[server] " + d.toString()));

function req(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const init = await req("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "lens-test", version: "1.0" },
});
console.log("initialize ok:", !!init.result);
notify("notifications/initialized", {});

const tools = await req("tools/list", {});
const names = (tools.result?.tools || []).map((t) => t.name);
console.log("TOOLS:", tools.result?.tools?.length, names.join(","));

const call = await req("tools/call", {
  name: "semantic_analyze",
  arguments: { content: "# Hello\n\n## World\n\nSome text here.", meta: { path: "test.md" } },
});
console.log("CALL semantic_analyze isError:", !!call.result?.isError);
console.log("CALL result head:", (call.result?.content?.[0]?.text || "").slice(0, 200));

const res = await req("resources/read", { uri: "lens://manifest" });
console.log("RESOURCE lens://manifest:", (res.result?.contents?.[0]?.text || "").slice(0, 200));

child.kill();
const okTools = tools.result?.tools?.length >= 8;
const okCall = !call.result?.isError;
console.log(okTools && okCall ? "MCP-TEST: PASS" : "MCP-TEST: FAIL");
process.exit(okTools && okCall ? 0 : 1);
