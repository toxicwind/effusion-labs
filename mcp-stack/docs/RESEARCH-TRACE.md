This document traces reasoning for the SSE gateway consolidation.

- SSE chosen as transport with HTTP POST back-channel for client→server messages (JSONL).
- Lazy spawn of stdio children upon first SSE connect per server.
- Backoff restart strategy with exponential delay when clients present.
- Discovery surface emits live URLs per-profile and port.

Interlinker fortification:
- Before: wiki-link resolution could throw `document.match is not a function` on non-string inputs.
- After: inputs sanitized via `toHtmlString`, canonical-first resolution, and unresolved links recorded for audit.

Primary patterns referenced:
- Node HTTP SSE basics and headers
- JSON Lines over stdio

