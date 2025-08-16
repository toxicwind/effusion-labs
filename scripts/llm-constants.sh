#!/usr/bin/env bash
# Constants for LLM-safe test guardrails.
# Exported so shims and hijack share a single source of truth.
export LLM_KEEPALIVE_IMPORTS='--import=./test/setup/http.mjs --import=./test/setup/llm-keepalive.mjs'
