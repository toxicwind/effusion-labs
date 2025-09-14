# Stream Guard Environment Study

This study records the behaviour of the Hypebrut stream guard when capping visible frames at **3500 bytes**.

## Historical 4096-Byte Failure

Unwrapped console frames exceeding 4096 bytes caused truncation and session faults.

## 3500-Byte Window Rationale

A 3500-byte ceiling keeps each frame safely below the 4096-byte limit while leaving room for markers and terminal metadata.

## Guard Operation

1. **Arm**: `source utils/scripts/setup/env-bootstrap.sh`
2. **Status**: `hb_status`
3. **Disarm**: `hb_disarm`
4. **Inspect**: review sidecar logs printed in the arm banner.

## Before / After Highlights

* Long lines are split into `[HBWRAP i/n a..b]` frames.
* Carriage-return progress updates appear as separate lines.
* ANSI colouring is preserved.
* Mixed binary/text blocks emit a suppression notice while raw bytes land in sidecars.
* Real-world tools (e.g. `npm test`) stream legible, windowed output without session faults.
