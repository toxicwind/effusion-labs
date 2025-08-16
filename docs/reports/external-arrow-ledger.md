# Ledger: external-arrow

## Criteria
1. External links are prefixed with `↗` and gain `external-link` class.
2. Internal links remain unchanged without `external-link` class.
3. External links already prefixed with `↗` are not duplicated.

## Proof
- `docs/knowledge/external-arrow/markdown-links-red.log`
- `docs/knowledge/external-arrow/markdown-links-green.log`
- `docs/knowledge/external-arrow/markdown-links-refactor.log`
- `docs/knowledge/external-arrow/markdown-links-docsync.log`

## Rollback
- Last safe SHA: cfd091a
- To rollback: `git revert cfd091a..HEAD`
