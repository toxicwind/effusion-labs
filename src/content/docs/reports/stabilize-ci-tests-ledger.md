# stabilize-ci-tests Ledger (1/1)

## Criteria & Proofs

- Root-only install: `npm ci` at repo root (`docs/knowledge/stabilize-ci-tests-install.log`, sha256:
  26b1ab0e...).
- Browser probe: capability unavailable; parked specs none
  (`docs/knowledge/stabilize-ci-tests-green.log`, sha256: a49cf4e5...).
- Exit code 0 for test run (`docs/knowledge/stabilize-ci-tests-green.log`).

## Delta Queue

1. Add Playwright coverage for interactive components.
2. Enable image transforms in targeted specs.

## Rollback

- Last safe SHA: 49d7f59
- `git reset --hard 49d7f59`
