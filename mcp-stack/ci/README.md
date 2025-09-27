CI hooks (no egress):

- Use `docker-compose -f mcp-stack/ci/compose.ci.yml up -d` to start gateway + stubbed sidecars
  (WireMock).
- Run smoke + integration: `node mcp-stack/tests/smoke.mjs && node mcp-stack/tests/integration.mjs`.
- Do not call external domains; use stubs under `mcp-stack/ci/stubs/*`.
- The gateway enforces an allowlist when `CI=1`. Update `HOST_ALLOWLIST` in compose to control
  admitted DNS names.
- CF path exercised via WireMock: `GET http://searxng:8080/cf` (challenge) → FlareSolverr `/v1`.
