# tags-metadata Ledger

## Criteria

1. Metadata fields `tags`, `analytic_lens`, `memory_ref` and `spark_type` merge into a unified
   `tags` array.
2. `spark_type` surfaces as `categories` via global computed data.
3. `@quasibit/eleventy-plugin-schema@1.11.1` installed and registered.

## Proofs

- `test/unit/taxonomy.test.mjs` exercises tag and category computation.
- `docs/knowledge/tags-metadata/test-green.log` shows passing tests.
- `docs/knowledge/tags-metadata/docs-links.log` validates README links.
- `package-lock.json` lists `@quasibit/eleventy-plugin-schema@1.11.1` with integrity
  `sha512-Ln5VGI40txKJCbDX/ndXJp9lJOUHH75IpHn2E15uUN4LBRVW4BS/rimOL1iBVpnqJwFoVr3c+OubtC7sEQK9+w==`
  (MIT, https://github.com/quasibit/eleventy-plugin-schema).

## Index

3/3 criteria satisfied.

## Delta Queue

- none

## Rollback

Last safe commit: `836a84f20c2ded905792fd2806545c28e2c3ee4a` Rollback command:
`git reset --hard 836a84f20c2ded905792fd2806545c28e2c3ee4a`
