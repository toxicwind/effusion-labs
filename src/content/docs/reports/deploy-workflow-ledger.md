# deploy-workflow Ledger (1/1)

## Criteria & Proofs
- Failing check before removing pull_request trigger (`docs/knowledge/deploy-workflow-red.log`, sha256: c73465f226bf56ed7845a9c597016d4edc25980dcc3091442cd509e1c8ee9fa7).
- Passing check after restricting build to pushes (`docs/knowledge/deploy-workflow-green.log`, sha256: 3cdb44f2631295616ad1aa1123cb494c21ef078f96f95f6805e9b5b0380b1a01).

## Delta Queue
1. Cover workflow_dispatch scenarios.
2. Document manual deployment process.

## Rollback
- Last safe SHA: 3512aea
- `git reset --hard 3512aea`
