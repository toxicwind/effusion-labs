# Ledger: homepage-latest-entries

## Criteria
- ensure homepage sections list latest entries (1-3 items)

## Proof
- test: `test/integration/homepage-latest.spec.mjs`
- failing log: `logs/homepage-latest-red.log`
- passing log: `logs/homepage-latest-green.log`

## Rollback
- `git revert --no-edit 1d1b77f bc8cafb 7e4bb2b 8fa389a`
