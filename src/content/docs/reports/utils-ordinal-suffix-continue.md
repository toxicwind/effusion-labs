# Continuation: utils-ordinal-suffix

## Recap

Added targeted unit tests for utility helpers, fixed ordinalSuffix to handle
negative numbers, refactored file cache logic, and synchronized documentation.

## Next Steps

1. Expand utilities test coverage for caching behavior when files change or are
   deleted.
2. Integrate utilities module into additional filters to reduce duplication.

## Trigger

`node --test test/unit/utils.test.mjs`

## Environment

- Effort: R3
- Toggles: none

## Reads

- Files: 20
- Surfaces: lib, test, docs

## Capture Hashes

- See ledger for artifact hashes.
