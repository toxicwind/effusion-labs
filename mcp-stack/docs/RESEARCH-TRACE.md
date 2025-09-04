This document traces reasoning for the SSE gateway consolidation.

- SSE chosen as transport with HTTP POST back-channel for client→server messages (JSONL).
- Lazy spawn of stdio children upon first SSE connect per server.
- Backoff restart strategy with exponential delay when clients present.
- Discovery surface emits live URLs per-profile and port.

Primary patterns referenced:
- Node HTTP SSE basics and headers
- JSON Lines over stdio

