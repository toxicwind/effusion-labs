# Stream Guard Environment Study

The Linux PTY layer exposes a ~4096 byte frame boundary. When a program writes a single line longer than this limit, the tail is truncated or the session wedges.

Setting a visible window of **3500 bytes** leaves headroom for escape sequences and guard prefixes while remaining well under the PTY ceiling. Any line longer than this is segmented with `[HBWRAP i/n a..b]` markers that show exact byte offsets while the raw stream is preserved in sidecar logs.

## Before
Unwrapped output over 4 KiB would vanish:
```
printf %s "$(head -c 5000 /dev/zero)"
# → console truncates after 4096 bytes
```

## After
```
python3 - <<'PY'
print('Y'*3600)
PY
```
produces
```
[HBWRAP 1/2 1..3500] YYYYY…
[HBWRAP 2/2 3501..3600] YYYYY…
```
with the full raw bytes stored in the sidecar log.

## Operational Notes
* **Arm:** `source utils/scripts/setup/env-bootstrap.sh`
* **Status:** `hb_status` (reports width and sidecar paths)
* **Disarm:** `hb_disarm` (restores FDs, removes helper FIFOs)
* **Inspect sidecars:** paths printed in the arm banner or saved in `var/hb_guard_env.json`.
