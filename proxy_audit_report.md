# Proxy Audit Report

## Environment Snapshot
- Node: v22.18.0
- npm: 11.4.2
- Playwright: 1.54.2
- CHAIN_PROXY_URL: http://127.0.0.1:8899 (shim exits with ECONNRESET)

## Baseline Reachability
```
[baseline] OK
```

## DNS Resolution
```
172.96.160.178  mildlyawesome.com
```

## Proxy Hop Proofs
### Pre-hop
```
[pre-hop] OK
```
### Second hop unauthenticated
```
200
```
### Second hop authenticated
```
200
```

## Chain Shim Proof
```
HTTP/1.1 595 ECONNRESET
```

## Test Attempts
```
npm test
pass 1
```

## External Blocker
- chain-proxy.mjs unable to establish upstream tunnel: `ECONNRESET`

## Final Status
FAIL – chain proxy 595 ECONNRESET; search2serp and web2md not exercised
