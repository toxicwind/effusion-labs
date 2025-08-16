# Ledger: plugins-deadlink

## Criteria & Proofs
1. Interlinker plugin disables dead link report.
   - Proof: test `interlinker disables dead link report` passes and plugin options include `deadLinkReport: 'none'`.
2. Plugin list structure returns arrays with functions.
   - Proof: unit test `plugin list structure` passes.
3. Interlinker options contract ensures default layout and dead link report.
   - Proof: unit test `interlinker options contract` passes.

## Evidence
- `lib/plugins.js` SHA256: 09191d1a48052dbf77607ce64afd58f61795f738f3d9aaee835cbd1f708ed78d
- `test/unit/plugins-deadlink.test.mjs` SHA256: 903b91cdac92e6ad59ce5e9e3e27c80ebecd6da4265f2b5f4153624f3e6f0359
- `logs/plugins-deadlink-red.log` SHA256: ba4acbc9a07aa2e87d9b6e9c96f9e14be9c8c90d5033ee32a934ebc33679d6f4

## Acceptance Map
- Criteria satisfied: 3/3

## Rollback
- Last safe SHA: edf20b00f0d3fe9d633f029e88de76a2b147ab30
- Rollback command: `git revert edf20b00f0d3fe9d633f029e88de76a2b147ab30`

## Delta Queue
1. Add Eleventy build integration test to ensure no dead link warnings during build.
2. Document interlinker configuration in README.

