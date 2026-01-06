# Ledger: homepage-latest-entries

## Criteria

- ensure homepage sections list latest entries (1-3 items)

## Proof

- test: `test/integration/homepage-latest.spec.mjs`
- test: `test/unit/index-data.test.mjs`
- failing log: `logs/homepage-latest-red.log`
- passing log: `logs/homepage-latest-green.log`

## Rollback

- `git revert --no-edit be9d46c 8faaea7 0df3f83 6b14766 1d1b77f bc8cafb 7e4bb2b 8fa389a`
