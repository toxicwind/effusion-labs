---
title: Stream Guard — 3500 default
description: Output guard with 3500-byte soft wrap, per-process sidecars, and debounced suppression.
---

The stream guard is enabled by sourcing `utils/scripts/setup/env-bootstrap.sh`.

- Default width: 3500 bytes (`HB_FILTER_W` overrides).
- Flush threshold: ~4× width (`HB_FILTER_FLUSH` overrides).
- Per-process sidecars: `.hb-logs/<PID>.stdout.log` and `.hb-logs/<PID>.stderr.log` capture the raw stream.
- Allowed control bytes: TAB, LF, CR, ESC, BS, VT, FF. Backspace is sanitized before windowing.
- Unsafe control bytes (NUL, DEL, and other disallowed C0) are dropped from console and summarized once per window as `[HBBIN suppressed N bytes]`. Sidecars retain raw bytes.
- Long lines are wrapped with markers `[HBWRAP i/n a..b] <chunk>`.

Helpers exported when armed:

- `hb_status`: prints guard status to stderr.
- `hb_disarm`: restores FDs and cleans up.
- `hb_run <cmd>`: runs a command under PTY or line-buffered where available to preserve streaming.
