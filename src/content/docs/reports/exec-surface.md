# Unguarded Execution Surface

## Environment
- `uname -a`: Linux 0bd838b31262 6.12.13 #1 SMP Thu Mar 13 11:34:50 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux
- `SHELL`: /bin/bash
- `bash --version`: GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)
- `set` flags: ehuB
- `PID`: 4168
- FD1 type: /dev/pts/0
- FD2 type: /dev/pts/0
- `tty`: not a tty

## Stdout vs stderr merging
Console ordering showed stderr lines before stdout lines (`ERR1`, `ERR2`, `OUT1`, `OUT2`), indicating merged but unsynchronized streams.

## Line-length ceiling
| size | console_sample_len | file_len |
| --- | --- | --- |
| 1024 | 201 | 1025 |
| 2048 | 201 | 2049 |
| 3072 | 201 | 3073 |
| 3500 | 201 | 3501 |
| 3800 | 201 | 3801 |
| 5000 | 201 | 5001 |

Console samples were intentionally clipped to 200 bytes (plus newline). Full files recorded exact lengths; no truncation observed.

## Redirection with `source`
- Case A: `AFTER_A_*` lines landed in `fd_demo_caseA.*` files alongside `INSIDE_DEMO_*`.
- Case B: `AFTER_B_*` lines remained on console, while `fd_demo_caseB.*` contained only `INSIDE_DEMO_*`.

Redirection on the `source` line overrides descriptor changes inside the sourced file; FDs revert after the grouped command.

## Subshell vs same shell
`FOO=parent; bash -lc 'echo CHILD_FOO=${FOO:-unset}'` produced `CHILD_FOO=unset`, while the parent recorded `PARENT_FOO=parent`. Subshells do not inherit local variables by default.
