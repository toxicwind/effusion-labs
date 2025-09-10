# homepage-hero Ledger (5/5)

## Criteria & Proofs
- Failing check before fix (`docs/knowledge/homepage-hero-red.log`, sha256: 355ca2527fa59f5b8a95afac05afb1814781657b11917fbd428ba1d8f7f2363a).
- Passing check after implementing filters and lab seal (`docs/knowledge/homepage-hero-green.log`, sha256: 6c742c45ef15ab45e41246804e258340105a70cfb47951cfc2e7f06f8416dc76).
- Failing check before restoring map CTA (`docs/knowledge/homepage-hero-map-red.log`, sha256: 8f566692af82968703cffcbe7588ce88edd24c8c6ddaf2177e0aa29f0b6f48d8).
- Passing check after restoring map CTA and layout (`docs/knowledge/homepage-hero-map-green.log`, sha256: f576f7e398bf400f5a56baae65d70232c29a410accf7a1cd3e517511f2de8ead).
- Failing check before feed grid and card redesign (`docs/knowledge/homepage-feed-red.log`, sha256: 418580a7655b4d98ae542e441bec95b3701d5df6eca8518a54ab267df9f82928).
- Passing check after feed grid and card redesign (`docs/knowledge/homepage-feed-green.log`, sha256: 6ac328aeb5a04dcf696092d99601e554c6c6b579096c63dbe1a5295a2d68c4ac).

## Delta Queue
- integrate rich metadata into Work collection and add showcase article
- enforce fluid type scale and 8px spacing with full accessibility pass

## Rollback
- Last safe SHA: 0b8c188
- `git reset --hard 0b8c188`
