This document traces reasoning for the SSE gateway consolidation.

- SSE chosen as transport with HTTP POST back-channel for client→server messages (JSONL).
- Lazy spawn of stdio children upon first SSE connect per server.
- Backoff restart strategy with exponential delay when clients present.
- Discovery surface emits live URLs per-profile and port.

Interlinker fortification:

- Before: wiki-link resolution could throw `document.match is not a function` on non-string inputs.
- After: inputs sanitized via `toHtmlString`, canonical-first resolution, and unresolved links recorded for audit.
- v2: Patched both CJS and ESM plugin surfaces (`@photogabble/eleventy-plugin-interlinker@1.1.0`) via patch-package; added i18n-aware href prefixing and generalized multi-scaffold resolvers.
- v3: Coerced all parser inputs to strings (CJS + ESM), added sentinel comments, introduced `safeMatch(...)`, fixed Docker layering so `patch-package` sees `patches/` in deps stage, and added CI guard (`utils/scripts/validation/verify-patch-applied.mjs`).

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

Queue/Rate observations:

- Queue-first policy: 200 concurrent one-shots enqueue, no 429s; `/admin/queue` reflects backlog and drains FIFO.
- `/admin/rate` reports policy `{ limitPerSec: 50, burst: 100 }` (advisory; enforcement delegated to queue throughput).

Auto-correction notes:

- CF detection: server header `cloudflare` or content markers (`__cf_bm`, "Just a moment", `cf-mitigated: challenge`, `/cdn-cgi/challenge-platform/`).
- When detected, gateway probes `FLARESOLVERR_URL` or `http://flaresolverr:8191` with `POST /v1 {cmd:sessions.list}`; success triggers retry via FlareSolverr.
- In CI, WireMock provides deterministic `/v1` responses to exercise the same path without egress.

Latest bench (stub mode, Sep 5 2025):

- p95 latency: ~120ms
- gateway RSS: ~20 MB
