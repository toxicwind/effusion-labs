# llm-keepalive Ledger

## Criteria
1. Keepalive module emits heartbeat to stderr.
2. First SIGINT ignored; second exits with code 130.

## Proof
- test: `test/unit/llm-keepalive.test.mjs`
- passing run: see chunk 606e9d

## Rollback
- last safe SHA: bbe538a
- rollback command: `git revert bbe538a`
