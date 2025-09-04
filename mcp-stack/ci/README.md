CI hooks (no egress):
- Use `docker-compose -f mcp-stack/ci/compose.ci.yml up -d` to start gateway + stubbed sidecars (WireMock).
- Run smoke + integration: `node mcp-stack/tests/smoke.mjs && node mcp-stack/tests/integration.mjs`.
- Do not call external domains; use stubs under `mcp-stack/ci/stubs/*`.
