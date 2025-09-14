#!/bin/bash
set -euo pipefail
out_dir="var/exec_probe"
# Save originals
exec 3>&1 4>&2
# Case A: direct source
source scripts/probe/fd_demo.sh
echo AFTER_A_OUT
echo AFTER_A_ERR >&2
# Restore and archive
exec 1>&3 2>&4
mv "$out_dir/fd_demo.out.txt" "$out_dir/fd_demo_caseA.out.txt"
mv "$out_dir/fd_demo.err.txt" "$out_dir/fd_demo_caseA.err.txt"
# Case B: source within redirection
{ source scripts/probe/fd_demo.sh; } >/dev/null 2> "$out_dir/source_wrap.err.txt"
echo AFTER_B_OUT
echo AFTER_B_ERR >&2
# Capture case B outputs
mv "$out_dir/fd_demo.out.txt" "$out_dir/fd_demo_caseB.out.txt"
mv "$out_dir/fd_demo.err.txt" "$out_dir/fd_demo_caseB.err.txt"
# Restore final
exec 1>&3 2>&4
