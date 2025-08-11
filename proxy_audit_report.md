# Proxy Audit Report

## Environment
- Node: v22.18.0
- npm: 11.4.2
- Playwright: 1.54.2
- OUTBOUND_PROXY_URL: http://mildlyawesome.com:49159
- OUTBOUND_PROXY_USER: toxic
- OUTBOUND_PROXY_PASS: A***************mx
- http_proxy/https_proxy: http://toxic:A***************mx@mildlyawesome.com:49159
- CODEX_PROXY_CERT present

## Preflight
- DNS: `getent hosts mildlyawesome.com` → `172.96.160.178`
- TCP: `nc -vz mildlyawesome.com 49159` → `Network is unreachable`
- Unauth curl: `curl -x http://mildlyawesome.com:49159 http://example.com` → `curl: (7) Failed to connect` (`000`)
- Auth curl: `curl -x http://mildlyawesome.com:49159 -U toxic:*** https://httpbin.org/ip` → `curl: (7) Failed to connect` (`000`)

## Dependency Installs
- `npm ci` (root) — success
- `npm ci` (tools/web2md) — success
- `npm ci` (tools/search2serp) — success
- `npm run build:tools` — success
- `npx playwright install chromium` — success
- `npx playwright install-deps` — failed: `Cannot initiate the connection to mildlyawesome.com:49159`

## Code Changes
- Added build script for vendored Google search tool
- Introduced vendored `tools/google-search` module and CLI
- Updated `search2serp` to prefer vendored tool and fall back to BrowserEngine
- Added proxy-aware E2E harness `scripts/e2e-serp-proxy-check.sh`
- Added self-healing loop `scripts/self-heal-run.sh`

## E2E Runs
- `scripts/e2e-serp-proxy-check.sh` — failed: `nc: connect ... port 49159 ... Network is unreachable`

## Final Status
**FAIL** — Proxy port 49159 unreachable; search2serp/web2md cannot reach external destinations. Verify network/firewall or try standard ports (3128/8080).
