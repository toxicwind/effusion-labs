#!/bin/bash
set -euo pipefail
out_dir="var/exec_probe"
FOO=parent; bash -lc 'echo CHILD_FOO=${FOO:-unset}' > "$out_dir/child_env.txt"
echo PARENT_FOO=${FOO:-unset} > "$out_dir/parent_env.txt"
