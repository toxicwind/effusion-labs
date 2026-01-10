# 🧪 EFFUSION LABS | HYPERBRUT CI ENGINE
> **VERSION: 2026.1.0** | **STANCE: CONSTRAINED_CI_MASTERY**

---

## 🟥 LIVE REPO BREAKDOWN (3X NON-BASELINE)

### 1. THE BUILD STACK [STATUS: OPTIMIZED]
Effusion Labs is a high-performance Eleventy-driven site engineered for **Hypebrut** aesthetics and constrained environments. The stack is ultra-modern, leveraging bleeding-edge versions of the core web ecosystem.

*   **CORE:** Eleventy 3.0 + Vite 7.0 + Tailwind 4.0
*   **LOGIC:** Node.js ≥ 22.19 (ESM Only)
*   **UI:** daisyUI 5.0 (Custom Hypebrut Tokens)
*   **BROWSER:** Chromium-driven policy targeting system binaries (Puppeteer/Playwright).

### 2. WHERE WE ARE AT [NETWORK_GATE: ACTIVE]
We have successfully implemented a "Network Contract" for CI, ensuring deterministic builds even in hostile or air-gapped environments.

| LAYER | STATUS | COMPONENT | ROLE |
| :--- | :--- | :--- | :--- |
| **Site Build** | 🟢 STABLE | Eleventy 3.0 | Static site generation with Vite hydration. |
| **Tooling** | 🟢 ACTIVE | `tools/` | Chromium resolvers and LV Images pipeline. |
| **CI Gate** | 🟢 HARDENED | `ci.yml` | Three-stage lint/test/build with offline shims. |
| **MCP Matrix** | 🟡 INTEGRATED | `mcp-stack/` | Gateway for AGENT-based interrogation. |
| **Shell Shims** | 🟢 ACTIVE | `bin/bin/` | Deterministic CLI wrappers (rg, fd, curl). |

### 3. PROTOCOL: CHROMIUM ISOLATION
Effusion Labs rejects the uncertainty of CDN-fetched browsers. All tooling (`Puppeteer`, `Playwright`) is strictly mapped to the system Chromium binary.
*   **Resolution:** `tools/resolve-chromium.mjs`
*   **Gatekeeper:** `bin/chromium` shim.
*   **Validation:** `tools/check-chromium.mjs` (Run before every test cycle).

---

## 🚀 STRATEGIC WORKFLOWS

### The "Quality Gate"
```bash
npm run check  # Doctor -> Quality Check -> Integration Tests
```

### LV Images Pipeline (Sync/Crawl)
```bash
npm run lv-images:sync  # Refresh + Bundle + Verify
```

### CI-Safe Build
```bash
npm run build:ci  # Production build with network contract enforcement
```

---

## 📂 ARCHITECTURAL HIERARCHY
*   **/src/content**: Markdown & Nunjucks primary source.
*   **/tools**: Build diagnostics and Chromium orchestration.
*   **/bin/bin**: The repository's "Nervous System" (Shims).
*   **/mcp-stack**: The gateway to Chronos-Forge awareness.

---
*Unified Effusion Labs Framework | Optimized for Autonomous Synthesis.*
