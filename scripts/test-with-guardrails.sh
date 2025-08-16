#!/usr/bin/env bash
set -euo pipefail

bash scripts/llm-bootstrap.sh
export BASH_ENV="$PWD/.llm-bash-env"
LLM_HEARTBEAT_SECS=10 LLM_MAX_MINS=30 LLM_SHELL_HEARTBEAT=1 npm test 2>&1 | tee test.log
scripts/warn-gate.sh test.log
