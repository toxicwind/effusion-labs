# home-sections-copy Ledger

m/n: 9/9

## Criteria
1. Copy integrated on homepage — see _site/index.html lines 118-130 and logs/home-sections-copy/build.log.
2. CTAs "View Latest Work" and "Launch the Map" link correctly — see _site/index.html lines 122-130.
3. Projects, Concepts, Sparks, Meta sections render ≤3 items — verified in tests/homepage.spec.mjs and logs/home-sections-copy/test.log.
4. Entry lists single-column with no grid classes — verified in tests/homepage.spec.mjs.
5. "Open Questions" removed — `rg -i "Open Questions" _site` returned no results.
6. Tests assert copy, CTAs, sections, single-column, and absence — logs/home-sections-copy/test.log.
7. `npm test` (full suite) completed — logs/home-sections-copy/full-test.log.
8. `npm run build` succeeded — logs/home-sections-copy/build.log.
9. Ledger & continuation updated — this ledger and docs/reports/home-sections-copy-continue.md.

## Delta Queue
- *(empty)*

## Stability
- `_site/index.html` SHA256 0b5ef0bba42acbc50b474df5a8f41319335044c45767fd0eef0184bd2aa3455a.
- Tests and build executed without error.

## Rollback Slot
- Commit 74266d7 — apply docs commit to reintroduce ledger.
