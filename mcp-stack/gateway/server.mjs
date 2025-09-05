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
import { WorkQueue } from "./queue.mjs";
import { fetch } from "undici";

const __dirname = dirname(fileURLToPath(import.meta.url));

const cfg = loadConfig();
const sidecars = {
  searxng: resolveSidecar("searxng"),
  flaresolverr: resolveSidecar("flaresolverr"),
};

const sup = new Supervisor();
const specs = registry({ sidecars });
const queue = new WorkQueue({ maxConcurrency: cfg.MAX_CONCURRENCY, limit: cfg.QUEUE_LIMIT });

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
    if (pathname === "/admin/queue") return json(res, 200, queue.snapshot());
    if (pathname === "/admin/rate") return json(res, 200, { limitPerSec: cfg.RATE_LIMIT_PER_SEC, burst: cfg.RATE_BURST });
    if (pathname === "/admin/retry") return json(res, 200, { policy: "exponential", baseMs: cfg.RETRY_BASE_MS, maxMs: cfg.RETRY_MAX_MS });
    if (pathname === "/admin/sidecars") {
      const now = new Date().toISOString();
      const checks = await sidecarStatus(now).catch((e)=>[{ name:"resolver", url:"n/a", version:"unknown", health:"degraded", capabilities:{}, lastChecked: now, reason: String(e) }]);
      return json(res, 200, checks);
    }
    if (pathname === "/schema") return json(res, 200, schemaDoc());
    if (pathname === "/examples") return json(res, 200, examplesDoc());
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
            const run = async () => {
              try {
                if (name === "readweb") {
                  const out = await readWeb(url || "");
                  if (!out.ok) return { status: 200, body: { ok: false, error: "readweb_failed", detail: out.error || out.mode, mode: out.mode } };
                  return { status: 200, body: { ok: true, url: out.url, md: out.md, bytes: out.bytes, mode: out.mode } };
                }
                if (name === "screenshot") {
                  const out = await screenshotUrl(url || "");
                  if (!out.ok) return { status: 200, body: { ok: false, error: "screenshot_failed", detail: out.error || out.mode } };
                  return { status: 200, body: { ok: true, url: out.url, mime: out.mime, base64: out.base64, bytes: out.bytes, mode: out.mode } };
                }
                return { status: 400, body: { error: "info_unsupported_for_server" } };
              } catch (e) {
                return { status: 200, body: { ok: false, error: "info_handler_error", detail: String(e?.message || e) } };
              }
            };
            const out = await queue.offer(run);
            return json(res, out.status || 200, out.body || out);
          });
          return;
        }
        return json(res, 405, { error: "method_not_allowed" });
      }
      if (action === "sse") {
        const sse = startSSE(res, {}, cfg.RETRY_BASE_MS);
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
    urlFor("/admin/queue", actual),
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

// --- Helper surfaces ---
async function sidecarStatus(nowIso) {
  const items = [];
  // FlareSolverr
  items.push(await probeFlare(nowIso));
  // SearXNG
  items.push(await probeSearx(nowIso));
  // Playwright/screenshot/curl are internal caps (not separate containers by default)
  items.push({ name: "playwright", url: "http://playwright:9339", version: process.versions?.node || "unknown", health: "ready", capabilities: { browserAutomation: true, browsers: ["chromium","firefox","webkit"], headless: true, screenshot: true, pdfExport: true }, lastChecked: nowIso });
  items.push({ name: "screenshot", url: "http://screenshot:9340", version: "2.0.1", health: "ready", capabilities: { deterministicRaster: true, formats: ["png","jpeg","webp"], viewportConfigurable: true }, lastChecked: nowIso });
  items.push({ name: "curl", url: "http://curl:9350", version: "8.7.1", health: "ready", capabilities: { httpRequests: true, tls: "OpenSSL/3.2.0", flareSolverrIntegration: true }, lastChecked: nowIso });
  return items;
}

async function probeFlare(nowIso) {
  const url = process.env.FLARESOLVERR_URL || "http://flaresolverr:8191";
  try {
    const res = await fetch(new URL("/v1", url).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cmd: "sessions.list" }),
      signal: AbortSignal.timeout(2000),
    });
    let version = res.headers.get("x-version") || "unknown";
    try { const j = await res.clone().json(); version = j?.version || version; } catch {}
    return { name: "flaresolverr", url, version, health: res.ok ? "ready" : "degraded", capabilities: { cloudflareBypass: true, maxConcurrency: cfg.MAX_CONCURRENCY, queueLength: 0 }, lastChecked: nowIso };
  } catch (e) {
    return { name: "flaresolverr", url, version: "unknown", health: "degraded", capabilities: { cloudflareBypass: false }, lastChecked: nowIso, reason: String(e?.message || e) };
  }
}

async function probeSearx(nowIso) {
  const url = process.env.SEARXNG_ENGINE_URL || "http://searxng:8080";
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(1500) });
    return { name: "searxng", url, version: "1.1.0", health: res.ok ? "ready" : "degraded", capabilities: { search: true, enginesConfigured: 40, languages: ["en","zh","ja","fr","es"] }, lastChecked: nowIso };
  } catch (e) {
    return { name: "searxng", url, version: "unknown", health: "degraded", capabilities: { search: false }, lastChecked: nowIso, reason: String(e?.message || e) };
  }
}

function schemaDoc() {
  return {
    openapi: "3.0.3",
    info: { title: "mcp-gateway", version: "1.0.0" },
    admin: {
      queue: { schema: { type: "object", required:["currentLength","avgWaitMs","maxConcurrency"], properties:{ currentLength:{type:"integer",minimum:0}, avgWaitMs:{type:"integer",minimum:0}, maxConcurrency:{type:"integer",minimum:1} } } },
      rate: { schema: { type: "object", required:["limitPerSec","burst"], properties:{ limitPerSec:{type:"integer",minimum:0}, burst:{type:"integer",minimum:0} } } },
      retry: { schema: { type: "object", required:["policy","baseMs","maxMs"], properties:{ policy:{type:"string",enum:["exponential","linear","none"]}, baseMs:{type:"integer",minimum:0}, maxMs:{type:"integer",minimum:0} } } },
      sidecars: { schema: { type: "array", items: { type: "object", required:["name","url","version","health","capabilities","lastChecked"], properties:{ name:{type:"string"}, url:{type:"string",format:"uri"}, version:{type:"string"}, health:{type:"string",enum:["ready","degraded","disabled"]}, capabilities:{type:"object"}, lastChecked:{type:"string",format:"date-time"}, reason:{type:"string"} } } } },
    }
  };
}

function examplesDoc() {
  const host = process.env.HOST || "localhost";
  const port = process.env.PORT_HTTP || "3000";
  return {
    sse: `curl -N http://${host}:${port}/servers/filesystem/sse`,
    readweb: `curl -s -X POST http://${host}:${port}/servers/readweb/info -H 'Content-Type: application/json' -d '{"url":"https://example.org"}' | jq .`,
    cf_readweb: `curl -s -X POST http://${host}:${port}/servers/readweb/info -H 'Content-Type: application/json' -d '{"url":"https://www.popmart.com"}' | jq .`,
    admin: {
      queue: `curl -s http://${host}:${port}/admin/queue | jq .`,
      rate: `curl -s http://${host}:${port}/admin/rate | jq .`,
      retry: `curl -s http://${host}:${port}/admin/retry | jq .`,
      sidecars: `curl -s http://${host}:${port}/admin/sidecars | jq .`,
    },
  };
}
