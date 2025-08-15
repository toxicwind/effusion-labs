# npm-docs-links Ledger (1/1)

## Criteria & Proofs
- `npm ci` succeeds with lockfile (`docs/knowledge/npm-docs-links-install.log`, sha256: 0f4c7440…).
- README links pass check (`docs/knowledge/npm-docs-links-green.log`, sha256: 7ad48fca…).
- Test suite exits 0 (`docs/knowledge/npm-docs-links-green.log`).

## Delta Queue
1. Add automated badge for docs link status.
2. Explore caching for markdown-link-check.

## Rollback
- Last safe SHA: a6a9053
- `git reset --hard a6a9053`
