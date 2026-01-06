# Ledger: utils-ordinal-suffix

- Time Anchor: Sun Aug 17 23:39:58 UTC 2025
- Diffstat:

```
README.md                          |    1 +
docs/knowledge/docs-links.md       |    8 +
docs/knowledge/utils-test-green.md |   10 +
docs/knowledge/utils-test-red.md   |   11 +
lib/utils.js                       |   11 +-
logs/docs-links.log                |   23 ++
logs/test-utils-green.log          |   28 +++
logs/test-utils-red.log            | 1149 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
test/unit/utils.test.mjs           |   24 ++
9 files changed, 1260 insertions(+), 5 deletions(-)
```

- Files Changed: lib/utils.js, test/unit/utils.test.mjs, README.md, docs/knowledge/_.md, logs/_.log
- Proofs:
  - Failing: logs/test-utils-red.log
  - Passing: logs/test-utils-green.log
  - Docs Links: logs/docs-links.log
- Acceptance Map:
  - ordinalSuffix handles negative numbers → test/unit/utils.test.mjs
  - ordinalSuffix uses "th" for teens → test/unit/utils.test.mjs
  - readFileCached returns null for nonexistent path → test/unit/utils.test.mjs
- Commit Graph:

```
831acd8 docs:utils sync docs with repo state
f3d5486 refactor:utils unify and modernize
acadd71 feat:utils implement fix to green
121ee95 ci:utils record failing proofs
eb561b6 test:utils define acceptance + property + contract
4c160d8 ci(monsters-product-metadata): capture failing green run
```

- Artifact Hashes:

```
bf69d581d8c1ab6759d748e5f1e4764edf312fbd03212bf708fc7ecfeca8fbc6  logs/test-utils-red.log
1770bea0f37720506ce01fd46b8c6e31cdb0bc28e29c9e5a7f52da1948cbdae7  logs/test-utils-green.log
f13671568040182d054b7dce248859d6174f9645b7896219305a2a1c76b4e3e3  logs/docs-links.log
d7aa5ef97b9d39898820faca3326bc8496148032cea00f7e123d33e60aff18cc  docs/knowledge/utils-test-red.md
7b79e88918666d21f42c2db9484110a145871fe2e305a2353b0841d44e4cfaac  docs/knowledge/utils-test-green.md
c1f3f294aab5118fd4b1775399dba5429a1466ea18a2d525ded55f74ad4cf75f  docs/knowledge/docs-links.md
```

- Network Route: direct
- Rollback: git reset --hard 4c160d8236b416e4781000a148c3aae4ac25823b
