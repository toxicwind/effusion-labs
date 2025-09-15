# gha-actions-upgrade Ledger

## Criteria

1. GitHub workflows use actions/checkout@v4.
2. Workflows use actions/setup-node@v4 in all jobs.
3. Deploy workflow uses actions/upload-artifact@v4.

## Proofs

- `test/unit/workflow-actions.test.mjs` checks for legacy action versions.
- `docs/knowledge/gha-actions-upgrade/test-success.log` shows passing targeted
  tests.
- `docs/knowledge/gha-actions-upgrade/docs-links.log` records successful docs
  link validation.

## Index

3/3 criteria satisfied.

## Delta Queue

- none

## Rollback

Last safe commit: `4aa4905d66b18635c624278daea324dac1c012ca` Rollback command:
`git reset --hard 4aa4905d66b18635c624278daea324dac1c012ca`
