# Proxy Audit Report

## Environment Snapshot
- Node: v22.18.0
- npm: 11.4.2
- Playwright: Version 1.54.2
- OUTBOUND_PROXY_ENABLED: 1
- OUTBOUND_PROXY_URL: http://mildlyawesome.com:49159
- OUTBOUND_PROXY_USER: toxic
- OUTBOUND_PROXY_PASS: A***x
- CODEX_PROXY_CERT present: yes 

## Proxy Preflight
### DNS
```
172.96.160.178  mildlyawesome.com
```
### TCP Reachability
```
nc: connect to mildlyawesome.com (172.96.160.178) port 49159 (tcp) failed: Network is unreachable
```
### Unauthenticated HTTP
```
curl: (7) Failed to connect to mildlyawesome.com port 49159 after 24 ms: Couldn't connect to server
000
```
### Authenticated CONNECT
```
curl: (7) Failed to connect to mildlyawesome.com port 49159 after 82 ms: Couldn't connect to server
000
```

## Dependency Installs
- `npm ci` (root, tools/search2serp, tools/web2md)
- `npx playwright install chromium` (success)
- `npx playwright install-deps` (failed: proxy unreachable)
- `npm run build:tools` (failed: tools/google-search missing)

## Code Changes
- Added `build:tools` script to package.json.
- Added `scripts/e2e-serp-proxy-check.sh` harness.
- Added `scripts/self-heal-run.sh` automation loop.

## E2E Harness Output
```
[Preflight] DNS lookup
172.96.160.178  mildlyawesome.com
[Preflight] TCP connectivity
nc: connect to mildlyawesome.com (172.96.160.178) port 49159 (tcp) failed: Network is unreachable
TCP connection failed
```

## Self-Heal Attempts
```
[self-heal] cycle 1
[Preflight] DNS lookup
172.96.160.178  mildlyawesome.com
[Preflight] TCP connectivity
nc: connect to mildlyawesome.com (172.96.160.178) port 49159 (tcp) failed: Network is unreachable
TCP connection failed
[self-heal] no change, stopping
```

## Remaining Issues
- Proxy at mildlyawesome.com:49159 unreachable from environment; all network calls fail.
- google-search vendored tool could not be fetched.

## Final Status
FAIL – network unable to reach proxy, so search2serp and web2md could not be verified end-to-end.
