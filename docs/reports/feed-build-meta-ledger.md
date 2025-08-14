# Ledger — feed-build-meta

## Index
1/1

## Entries
1. Expose build hash and time in RSS feed — done
   - Proof: `node --test tests/feed-build-meta.spec.mjs` chunk a3348e
   - Proof: `npm test` chunk 874e38

## Delta queue
1. Expand feed metadata to include generator link
2. Create snapshot tests for RSS feed structure

## Rollback slot
3e14486
