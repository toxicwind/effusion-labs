# AGENTS.md — effusion-labs (Repository Operational Rails)

**Purpose & Precedence** Repository-local rails for effusion-labs. This document complements the system prompt with repository-specific context and rules. It binds at **Priority Level ②** in the decision order (**User → AGENTS.md → Workspace → System Prompt**). System prompt **invariants are non-nullifiable**.

-----

## Stack & Commands (Repo Facts)

  * **Runtime**: Node 20
  * **Module system**: CommonJS (CJS)
  * **Site generator**: Eleventy (11ty)
  * **Templates**: Nunjucks
  * **Styling**: Tailwind CSS
  * **Content**: Markdown

-----

## R\&D Context (Repo Nuance)

This repository operates in an **internal prototype / R\&D** mode. Prefer solutions that maximize immediate functionality and speed to working results.

-----

## Guardrail Activation

After reading this file, bootstrap the repository's LLM guardrails so they monitor subsequent commands:

```bash
bash scripts/llm-bootstrap.sh
export BASH_ENV="$PWD/.llm-bash-env"
```

Run tests under guardrails with `npm run test:guard`. This wraps the test runner with heartbeat monitoring and warning gating. The first Ctrl+C (SIGINT) is ignored; the second exits with code `130`.

-----

## Operational Rails

### 1\. Experimental Expansion & Tooling

  * Adding new **public npm libraries** to expand capabilities is encouraged. Follow the discovery and integration process below.
  * The pattern `npm test > file` is forbidden; use a streaming `tee` pipeline instead.
  * When ingesting web content (i.e., `OUTBOUND_MARKDOWN_ENABLED` is truthy), use the repository’s helper tool for capture and normalization. Network I/O and artifact rules are otherwise governed by the system prompt.
  * **Legacy Artifacts**: The system prompt's **Ledger** and **Continuation** are the sole sources of truth. Legacy files like `index.jsonl` or `decisions.md` are superseded and should be ignored.

### 2\. npm Package Discovery & Integration

This rail governs the process for adding new npm packages to the repository.

**A. Discovery & Selection (REQUIRED FOR EVERY TASK OR USER INPUT)**

  * Use `npm view <pkg> --json` and `npm search <keyword>` to discover packages. Keywords should be derived from repository context (e.g., templates, filters).
  * Select packages that improve acceptance criteria or reduce duplication. Prioritize those with recent maintenance, a compatible Node.js engine (v20), a clear license, and a repository URL.

**B. Installation**

  * Install packages using an exact version: `npm install <pkg>@<version> --save-exact`
  * Record the `pkg@version`, repository URL, license, and the integrity hash from `package-lock.json` in the run's **Ledger**.

**C. Integration (Eleventy / CJS)**

  * **Default (CJS plugin)**:
    ```js
    // .eleventy.js
    const plugin = require('<pkg>');
    module.exports = function(eleventyConfig) {
      eleventyConfig.addPlugin(plugin /*, opts */);
    };
    ```
  * **ESM-only plugin (use dynamic `import()`)**:
    ```js
    // .eleventy.js
    module.exports = async function(eleventyConfig) {
      const { default: plugin } = await import('<pkg>');
      eleventyConfig.addPlugin(plugin /*, opts */);
    };
    ```

**D. Timing & Testing**

  * Follow the system prompt's `DEFINE → PROVE → FIX` sequence to add an acceptance test for the new functionality.
  * If a new package is required to pass acceptance criteria, install it during the **FIX** step.
  * Otherwise, prefer version bumps and modernization during the **CLEAN** (refactor) step, per the prompt's "Opportunistic Modernization" rule.

-----

*End of AGENTS.md — effusion-labs.*