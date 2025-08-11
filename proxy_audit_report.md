# Proxy Audit Report

## Environment Snapshot
- Node: v22.18.0
- npm: 10.9.3
- Playwright: 1.54.2
- HTTP_PROXY: http://proxy:8080
- HTTPS_PROXY: http://proxy:8080
- OUTBOUND_PROXY_URL: http://mildlyawesome.com:49159
- OUTBOUND_PROXY_USER: toxic
- OUTBOUND_PROXY_PASS: ******
- NODE_EXTRA_CA_CERTS: (unset)

## Baseline Reachability
```
[baseline] OK
```

## DNS & TCP Gate
```
172.96.160.178  mildlyawesome.com
nc: connect to mildlyawesome.com (172.96.160.178) port 49159 (tcp) failed: Network is unreachable
```

## Proxy Preflight
### Unauthenticated
```
curl: (7) Failed to connect to example.com port 80 after 44 ms: Couldn't connect to server
000
```
### Authenticated CONNECT
```
curl: (7) Failed to connect to httpbin.org port 443 after 51 ms: Couldn't connect to server
000
```

## Chain-Shim
- Not started: TCP gate failed

## Cloudflare Detections
- Not attempted

## Dependency Installs
- `npm install` (added proxy-chain)

## Code Changes
- Added chain proxy shim and CF mitigation helpers
- Wired BrowserEngine, proxy agent, search2serp, and webpageToMarkdown to env proxy and CF ladder

## E2E Attempts
- Not executed: outbound proxy unreachable

## External Blockers
- Final outbound proxy `mildlyawesome.com:49159` unreachable (network is unreachable)
  - Remediation: verify egress routing or use alternate accessible proxy

## Final Status
FAIL – unable to reach outbound proxy; search2serp and web2md not exercised
