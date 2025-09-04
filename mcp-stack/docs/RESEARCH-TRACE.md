This document traces reasoning for the SSE gateway consolidation.

- SSE chosen as transport with HTTP POST back-channel for client→server messages (JSONL).
- Lazy spawn of stdio children upon first SSE connect per server.
- Backoff restart strategy with exponential delay when clients present.
- Discovery surface emits live URLs per-profile and port.

Primary patterns referenced:
- Node HTTP SSE basics and headers
- JSON Lines over stdio

---
Bench snapshot (2025-09-04):

- Environment: Node v24, Linux x86_64, Playwright Chromium via @playwright/test
- SSE framing: `retry: 15000` header + `: ping` heartbeat every 15s; child emits `{type:"heartbeat"}` every 1s.
- Child exit handling: supervisor marks `degraded` on exit; manifest surfaces `health` per server.
- Profiles: `dev` shows absolute URLs; `prod` hides URLs and uses `INTERNAL_HOST` in manifest.
- Sidecar: `readweb` degrades on CF without `FLARESOLVERR_URL`; succeeds via FlareSolverr when set.
- Load (k6, 50 VUs, 30s, 3s client timeout): p95 ≈ 3.0s (timeout‑bounded), no crashes; gateway RSS ~92 MB steady.
