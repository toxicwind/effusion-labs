#!/usr/bin/env node
import http from "node:http";
import { parse as parseUrl } from "node:url";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadConfig } from "./config.mjs";
import { findPort } from "./ports.mjs";
import { log, banner } from "./logger.mjs";
import { startSSE } from "./sse.mjs";
import { Supervisor } from "./supervisor.mjs";
import { registry, findServer } from "../servers/registry.mjs";
import { resolveSidecar } from "../sidecars/resolver.mjs";
import { readWeb, screenshotUrl } from "./readers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const cfg = loadConfig();
const sidecars = {
  searxng: resolveSidecar("searxng"),
  flaresolverr: resolveSidecar("flaresolverr"),
};

const sup = new Supervisor();
const specs = registry({ sidecars });

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function html(res, code, body) {
  res.writeHead(code, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

function summarize() {
  return specs.map((s) => ({
    name: s.name,
    enabled: !!s.enabled,
    state: sup.state(s.name).status,
    se: sup.ensureClients(s.name).size,
  }));
}

function manifest(port) {
  return {
    profile: cfg.PROFILE,
    servers: specs.map((s) => ({
      name: s.name,
      enabled: !!s.enabled,
      health: sup.state(s.name).status,
      transport: {
        sse: urlFor(`/servers/${encodeURIComponent(s.name)}/sse`, port),
        info: urlFor(`/servers/${encodeURIComponent(s.name)}/info`, port),
        send: urlFor(`/servers/${encodeURIComponent(s.name)}/send`, port),
      },
      sidecars: s.name === "searxng" ? sidecars.searxng : s.name === "curl" ? sidecars.flaresolverr : undefined,
    })),
  };
}

function urlFor(path, port) {
  const host = cfg.PROFILE === "prod" ? cfg.INTERNAL_HOST : (process.env.HOST || "localhost");
  return `http://${host}:${port}${path}`;
}

async function main() {
  const port = await findPort({ fixed: cfg.PORT_HTTP, start: cfg.PORT_RANGE_START, end: cfg.PORT_RANGE_END });

  const server = http.createServer(async (req, res) => {
    const { pathname } = parseUrl(req.url || "");
    const method = req.method || "GET";
    log("debug", "http", "req", { method, pathname });

    if (pathname === "/healthz") return json(res, 200, { ok: true, ts: new Date().toISOString() });
    if (pathname === "/readyz") return json(res, 200, { ready: true, ts: new Date().toISOString() });
    if (pathname === "/servers") {
      const accept = (req.headers["accept"] || "").toLowerCase();
      const data = summarize();
      if (accept.includes("text/html")) {
        const rows = data.map((d) => `<tr><td>${d.name}</td><td>${d.enabled}</td><td>${d.state}</td><td>${d.se}</td><td><a href=\"/servers/${d.name}/sse\">sse</a></td></tr>`).join("");
        const body = `<!doctype html><meta charset='utf-8'><title>mcp-stack servers</title><style>body{font-family:ui-sans-serif,system-ui}table{border-collapse:collapse}td,th{padding:6px 10px;border:1px solid #ddd}</style><h1>mcp-stack servers</h1><table><tr><th>name</th><th>enabled</th><th>state</th><th>clients</th><th>stream</th></tr>${rows}</table>`;
        return html(res, 200, body);
      }
      return json(res, 200, { servers: data });
    }
    if (pathname === "/.well-known/mcp-servers.json") {
      return json(res, 200, manifest(server.address().port));
    }

    const m = pathname?.match(/^\/servers\/([^/]+)\/(info|sse|send)$/);
    if (m) {
      const [, name, action] = m;
      const spec = findServer(specs, name);
      if (!spec) return json(res, 404, { error: "server_not_found" });
      if (action === "info") {
        if (method === "GET") {
          const st = sup.state(name);
          return json(res, 200, { name, enabled: !!spec.enabled, state: st });
        }
        if (method === "POST") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", async () => {
            let payload = {};
            try { payload = JSON.parse(body || "{}"); } catch {}
            const url = payload.url || payload.target || payload.href;
            try {
              if (name === "readweb") {
                const out = await readWeb(url || "");
                if (!out.ok) return json(res, 502, { error: "readweb_failed", detail: out.error || out.mode, mode: out.mode });
                return json(res, 200, { ok: true, url: out.url, md: out.md, bytes: out.bytes, mode: out.mode });
              }
              if (name === "screenshot") {
                const out = await screenshotUrl(url || "");
                if (!out.ok) return json(res, 502, { error: "screenshot_failed", detail: out.error || out.mode });
                return json(res, 200, { ok: true, url: out.url, mime: out.mime, base64: out.base64, bytes: out.bytes, mode: out.mode });
              }
              return json(res, 400, { error: "info_unsupported_for_server" });
            } catch (e) {
              return json(res, 500, { error: "info_handler_error", detail: String(e?.message || e) });
            }
          });
          return;
        }
        return json(res, 405, { error: "method_not_allowed" });
      }
      if (action === "sse") {
        const sse = startSSE(res);
        const remove = sup.addClient(name, sse);
        const ensure = () => spec.enabled ? sup.spawn(name, spec) : null;
        try { await ensure(); } catch (e) { log("error", "spawn", "failed", { server: name, err: String(e) }); }
        const ping = setInterval(() => sse.ping(), 15_000);
        req.on("close", () => { clearInterval(ping); remove(); });
        return; // keep connection open
      }
      if (action === "send") {
        if (method !== "POST") return json(res, 405, { error: "method_not_allowed" });
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            await sup.spawn(name, spec);
            sup.send(name, payload);
            return json(res, 200, { ok: true });
          } catch (e) {
            return json(res, 400, { error: "invalid_json_or_send_failed", detail: String(e?.message || e) });
          }
        });
        return;
      }
    }

    json(res, 404, { error: "not_found" });
  });

  await new Promise((resolveListen) => server.listen(port, "0.0.0.0", resolveListen));
  const actual = server.address().port;
  const urls = [
    urlFor("/servers", actual),
    urlFor("/.well-known/mcp-servers.json", actual),
    urlFor("/healthz", actual),
  ];
  const lines = [` Profile: ${cfg.PROFILE}`, ` Port:    ${actual}`];
  if (cfg.PROFILE === "dev") lines.push(` URLs:    ${urls.join(" | ")}`);
  banner(lines);
  log("info", "startup", "listening", { port: actual, profile: cfg.PROFILE });
}

main().catch((e) => {
  log("error", "startup", "fatal", { err: String(e?.stack || e) });
  process.exit(1);
});
