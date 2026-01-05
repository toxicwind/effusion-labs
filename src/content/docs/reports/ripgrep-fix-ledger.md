# ripgrep-fix Ledger

## Criteria

1. Remove `@vscode/ripgrep` dev dependency to avoid GitHub download failures.
2. `prepare-docs` script no longer auto-installs ripgrep.
3. README reflects manual ripgrep requirement.

4. Remove `ripgrep-bin` dev dependency to avoid build tool requirement.

## Proofs

- `test/unit/ripgrep.test.mjs` checks absence of `@vscode/ripgrep` and script content.
- `docs/knowledge/ripgrep/test-success.log` shows passing tests.
- `docs/knowledge/ripgrep/docs-validate.log` records successful docs validation.
- package.json and package-lock.json omit `ripgrep-bin`.

## Index

4/4 criteria satisfied.

## Delta Queue

- none

## Rollback

Last safe commit: `7cdbb005636873796df6d63c5d2040dd19ef6b75` Rollback command:
`git reset --hard 7cdbb005636873796df6d63c5d2040dd19ef6b75`
