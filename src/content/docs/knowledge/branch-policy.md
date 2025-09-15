# Branch Policy

- Trunk: `main`
- Namespaces: `work/`, `feat/`, `fix/`, `merge/`, `chore/`, `release/`,
  `hotfix/`
- Flat branches equal to a namespace (e.g., `work`) are forbidden. Use
  `work/<stamp>-<slug>`.
- Local guard: `.githooks/pre-push` prevents pushing collisions.
- Helper: `scripts/git/new-branch` creates timestamped names safely.
