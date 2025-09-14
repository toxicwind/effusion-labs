#!/bin/bash
set -euo pipefail
out_dir="var/exec_probe"
# Collect basic environment info
{
  echo "uname -a: $(uname -a)"
  echo "SHELL: ${SHELL:-}"
  echo "bash --version: $(bash --version | head -n1)"
  echo "set flags: $-"
  echo "PID: $$"
} > "$out_dir/fd_tty_info.txt"
# FD types
readlink -f /proc/$$/fd/1 > "$out_dir/fd1_type.txt"
readlink -f /proc/$$/fd/2 > "$out_dir/fd2_type.txt"
# TTY info
(tty || true) > "$out_dir/tty.txt" 2>&1
if [ -t 0 ]; then
  stty -a > "$out_dir/stty.txt" 2>&1 || true
fi
