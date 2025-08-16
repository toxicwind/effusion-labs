# Ledger — solver-url-env

## Criteria & Proofs
1. Gateway reads `SOLVER_URL` from environment.
   - Proof: `test/unit/markdown-gateway-config.test.mjs`
   - Log: `docs/knowledge/solver-url-env-green.log`
2. Gateway retains default solver address when env absent.
   - Proof: `test/unit/markdown-gateway-config.test.mjs`
   - Log: `docs/knowledge/solver-url-env-green.log`

## Index
- satisfied criteria: 2/2

## Hashes
- `markdown_gateway/app.py` – ff7e62c0d736fd853b2c87d74d55b48b995d452e41548bc40f320a9286c5e2c7
- `test/unit/markdown-gateway-config.test.mjs` – eb274d2378195c462115a37eb7db29ef3656e388b5df40a9d106f36cf625a90e
- `README.md` – 78d61a92450e7504859518edd14486403e7e8ce7e0abf7109a846c6dc75cf18d
- `docs/knowledge/solver-url-env-red.log` – 91759e46712f5a23d9c2d357f7ba3c0b2736e5c9fd53cc898ad295f7437349de
- `docs/knowledge/solver-url-env-green.log` – 626e77808bc8dbda5ecacb14e5ab177e0c84b42b00678ad17dbb73f89d3997ba
- `docs/knowledge/solver-url-env-refactor.log` – c40f51d03f3e892e396e7ae637aa54ffc8cd99680d21aaae9340efd9b7695b9c
- `docs/knowledge/solver-url-env-docs.log` – f13671568040182d054b7dce248859d6174f9645b7896219305a2a1c76b4e3e3

## Rollback
- Last safe SHA: b155a3ab0060f0ab9f9f0e6228df764e6cd4daca
- Rollback command: `git reset --hard b155a3ab0060f0ab9f9f0e6228df764e6cd4daca`
