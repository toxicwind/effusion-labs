## mcp-stack — SSE Gateway (Validated)

This gateway multiplexes stdio‑based MCP servers behind an HTTP/SSE surface with
discovery, sidecar resolution (FlareSolverr, SearXNG), and basic observability.

Key endpoints:

- `GET /servers` — JSON or HTML summary.
- `GET /servers/:name/sse` — Server‑Sent Events stream, lazy‑spawns stdio child.
- `POST /servers/:name/send` — Write JSONL to server stdin.
- `GET|POST /servers/readweb/info` — One‑shot URL fetch → Markdown (Cloudflare
  aware).
- `POST /servers/screenshot/info` — One‑shot URL screenshot (PNG, Playwright).
- `GET /.well-known/mcp-servers.json` — Live discovery manifest (per‑profile
  URLs, health).
- `GET /healthz`, `GET /readyz` — Liveness and readiness.
- Admin (always responsive):
  - `GET /admin/queue` — FIFO queue snapshot
    `{ currentLength, avgWaitMs, maxConcurrency }`.
  - `GET /admin/rate` — `{ limitPerSec, burst }`.
  - `GET /admin/retry` — `{ policy: 'exponential', baseMs, maxMs }`.
  - `GET /admin/sidecars` — live status of sidecars with runtime UTC
    `lastChecked`.
  - `GET /schema` — OpenAPI/JSON schema summary.
  - `GET /examples` — ready‑to‑run cURL snippets.

### Configuration

- `PROFILE`: `dev` prints host URLs in banner; `prod` hides URLs and uses
  `INTERNAL_HOST` in manifest.
- `PORT_HTTP`/`PORT_SSE`: fixed port; `0` = ephemeral. Optional
  `PORT_RANGE_START/END`.
- `FLARESOLVERR_URL`: enable Cloudflare solving for `readweb` (e.g.
  `http://127.0.0.1:8191`).
- `HOST_ALLOWLIST`: comma separated hosts permitted for outbound requests
  (default `localhost,127.0.0.1`).
- `SEARXNG_ENGINE_URL`: optional sidecar reference (manifest only).
- `LOG_LEVEL`: `debug|info|warn|error` (default `info`).
- `INTERNAL_HOST`: prod manifest host (default `mcp-gateway`).

Engine-aware start:

```bash
./mcp-stack/scripts/engine-detect.sh    # prints podman|docker|none
./mcp-stack/scripts/run.sh              # auto uses containers or local stubs
```

Start FlareSolverr sidecar (Podman):

```bash
podman run -d --name flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest
export FLARESOLVERR_URL=http://127.0.0.1:8191
```

### Real‑world Examples (validated Sep 4, 2025)

- Cloudflare‑guarded (without sidecar → degraded; with sidecar → success):
  - Pop Mart:
    `curl -sX POST $BASE/servers/readweb/info -d '{"url":"https://www.popmart.com"}'`
  - KAWS:
    `curl -sX POST $BASE/servers/readweb/info -d '{"url":"https://www.kawsone.com"}'`
  - Bandai:
    `curl -sX POST $BASE/servers/readweb/info -d '{"url":"https://www.bandai.com"}'`

- Non‑CF (always succeed):
  - Example.org: `https://example.org`
  - Wikipedia: `https://www.wikipedia.org`
  - Nintendo: `https://www.nintendo.com`

Screenshot (non‑CF):

```bash
curl -sX POST $BASE/servers/screenshot/info -d '{"url":"https://example.org"}' | jq -r '.base64' | base64 -d > shot.png
```

### Observability

- Health: `GET /healthz` and `GET /readyz` return JSON.
- Logs: structured JSON Lines at `logs/gateway.jsonl` with fields
  `{ts, level, comp, msg, ...}`.

### Load Test Notes (k6)

Executed locally with 50 VUs for 30s against `/servers/demo/sse` using a 3s
client timeout to recycle streams:

- p95 `http_req_duration`: ~3.0s (timeout‑bounded)
- Gateway RSS (start→end): ~92 MB → ~92 MB (stable)
- No crashes; supervisor restarts children only on actual exits.

Script:

```bash
k6 run - <<'EOF'
import http from 'k6/http';
import { sleep } from 'k6';
export const options = { vus: 50, duration: '30s' };
export default function(){
  http.get(`${__ENV.BASE}/servers/demo/sse`, { timeout: '3s' });
  sleep(0.1);
}
EOF
```

Where `BASE=http://localhost:<port>` from the startup banner.

### Containerization

Local (Podman, real network):

```sh
podman build -t mcp-gateway ./mcp-stack/gateway
podman run --rm -p 3000:3000 -e PROFILE=dev --name mcp-gateway mcp-gateway
```

Compose overlays:

- Dev (host-published): `podman-compose -f mcp-stack/ci/compose.dev.yml up -d`
- Prod (internal-only): `podman-compose -f mcp-stack/ci/compose.prod.yml up -d`

CI (Docker, no egress, stubbed sidecars):

```sh
docker-compose -f mcp-stack/ci/compose.ci.yml up -d
```

In CI, outbound HTTP is blocked by the gateway allowlist:

- `CI=1` enables enforcement.
- `HOST_ALLOWLIST=flaresolverr,searxng,screenshot,curl,localhost,127.0.0.1`
  admits only stubbed service DNS names.

The integration test asserts CF auto-correction using WireMock:

- `GET http://searxng:8080/cf` returns a Cloudflare-like challenge page (403 +
  markers).
- Gateway routes via `POST http://flaresolverr:8191/v1` and returns
  `mode: "flaresolverr"`.

### POSIX scripts

- `mcp-stack/mcp-stack/scripts/run.sh` — starts gateway; honors `PORT_SSE=0` for
  ephemeral ports.
- `mcp-stack/scripts/check-health.sh` — probes `/healthz`, `/readyz`,
  `/.well-known`, `/admin/queue`, `/admin/rate`, `/admin/retry`,
  `/admin/sidecars`.
