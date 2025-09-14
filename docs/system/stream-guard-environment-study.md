# Stream Guard Environment Study

## Background
Lines near 4096 bytes trigger truncation in LLM/CI shells. Guard enforces 3500-byte windows to stay below boundary.

## Before
Without guard, long lines can overflow and crash sessions.

## After
With guard armed via `source utils/scripts/setup/env-bootstrap.sh`, output is chunked with markers `[HBWRAP i/n a..b]` and raw logs captured.

## Operation
- **Arm**: `source utils/scripts/setup/env-bootstrap.sh`
- **Status**: `hb_status`
- **Disarm**: `hb_disarm`
- **Inspect**: view sidecar log paths printed in banner.
