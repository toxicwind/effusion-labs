#!/bin/bash
set -euo pipefail
out_dir="var/exec_probe"
# Console merged view (clipped)
(
  echo OUT1
  sleep 0.02
  echo ERR1 >&2
  sleep 0.02
  echo OUT2
  sleep 0.02
  echo ERR2 >&2
) | cut -b1-200
# Capture full streams
{
  echo OUT1
  sleep 0.02
  echo ERR1 >&2
  sleep 0.02
  echo OUT2
  sleep 0.02
  echo ERR2 >&2
} > "$out_dir/merge_stdout.txt" 2> "$out_dir/merge_stderr.txt"
