# Ledger: products-template

- Time: 2025-08-18T18:25:35+00:00
- Diffstat:
  .github/workflows/deploy.yml | 6 ++--
  README.md | 2 +-
  lib/filters.js | 4 +--
  logs/product-template-pass.log | 119 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  src/\_includes/components/products/Badges.njk | 5 ---
  src/\_includes/components/products/MarketTable.njk | 2 +-
  src/\_includes/components/products/SpecSheet.njk | 10 +++---
  test/integration/monsters-product-metadata.spec.mjs | 12 +++----
  test/integration/product-template-build.spec.mjs | 5 +--
  9 files changed, 140 insertions(+), 25 deletions(-)
- Failing log: logs/product-template-fail.log
- Passing log: logs/product-template-pass.log
- Knowledge: docs/knowledge/product-template-fail.md
- Acceptance Map: products template heading, availability, unique heading.
- Commit Graph:
  9eb8b24 docs:products sync docs with repo state
  5bb9d0f refactor:products unify and modernize
  758d8ef feat:products implement fix to green
  406c445 ci:products record failing proofs
