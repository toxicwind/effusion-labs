# 📡 MCP-STACK | SSE GATEWAY
> **ARCHITECTURE: STDIO MULTIPLEXER** | **PROTOCOL: MCP v1.0**

---

## 🟥 TRANSPORT BREAKDOWN (3X NON-BASELINE)

### 1. THE SSE BRIDGE [STATUS: ACTIVE]
The **MCP-STACK** is the canonical gateway for multiplexing multiple stdio-based Model Context Protocol (MCP) servers behind a single HTTP surface. It provides high-fidelity streaming, discovery, and sidecar resolution.

*   **PROTOCOL:** Server-Sent Events (SSE) for downstream / HTTP POST for upstream.
*   **CORE MISSION:** Bridging the gap between isolated stdio processes and remote/agentic HTTP clients.
*   **SURFACE:** `GET /servers` (Discovery) | `GET /sse` (Stream) | `POST /send` (Command).

### 2. SERVER REGISTRY Matrix
| SERVER | MISSION | CAPABILITY |
| :--- | :--- | :--- |
| **filesystem** | I/O | Secure local file access and tree mapping. |
| **readweb**     | SCRAPE | Content extraction with Readability.js. |
| **playwright** | BROWSE | Full-headed/headless automation. |
| **curl**       | FETCH | FlareSolverr-backed request routing. |
| **searxng**    | SEARCH | Aggregated metasearch orchestration. |

### 3. SIDECAR ORCHESTRATION
*   **FlareSolverr:** Integrated into the `curl` server to bypass anti-bot challenges.
*   **SearXNG:** Private search engine backend for autonomous intelligence gathering.
*   **Discovery:** Live manifest at `/.well-known/mcp-servers.json`.

---

## 🚀 API ENDPOINTS

| ENDPOINT | METHOD | DESCRIPTION |
| :--- | :--- | :--- |
| `/servers` | `GET` | JSON discovery manifest (accepts text/html for humans). |
| `/servers/:name/sse`| `GET` | **Lazy-spawn** SSE stream for designated server. |
| `/servers/:name/send`| `POST` | Send JSON-RPC payloads to server stdin. |
| `/healthz` | `GET` | Readiness and liveness probes. |

---

## 🛠️ USAGE & SETUP

### Launch Gateway
```bash
node gateway/server.mjs
# Env opts: PROFILE=prod PORT_HTTP=3000
```

### Smoke Test
```bash
node tests/smoke.mjs
```

### Direct Interrogation
```bash
curl -N http://localhost:3000/servers/demo/sse
```

---

## 🔒 SECURITY GATE
*   **Profiles:** `dev` (verbose/permissive) vs `prod` (restricted).
*   **Observability:** Integrated health checks and JSON-line logging.
*   **Future:** Workspace-level allowlists and per-server concurrency limits.

---
*Unified MCP Framework | Managed by Chronos-Forge.*
