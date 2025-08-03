# AGENTS.md — effusion-labs: Experimental Extension & Operation Policy

This file signals project-specific values and guardrails for exploratory agents.
Refer to the universal protocol spec for continuous web research and core process.

---

## 1. Baseline Technology Lock (with Experiment Flag)

- **Core stack (default):**
  - Generator: Eleventy (11ty)
  - Templates: Nunjucks
  - Styling: Tailwind CSS
  - Content: Markdown
- Experimental alternative stacks may be tried under a clearly named feature flag (for example, feature.experimentalGenerator) and must not be merged without explicit human approval.

---

## 2. Extension & Capability Policy

Agents may add plugins, filters, asset pipelines, toolchains, reporting, content tooling, image optimizers, and similar capabilities, provided all of the following hold unless overridden by an experimental flag:

1. The core stack remains the primary build path.
2. Extensions should be modular via configuration; non-modular tweaks are allowed but flagged as experimental.
3. Changes are preferably non-destructive; one-off patches may be made but should be documented.
4. No runtime CDN imports by default—external scripts should be vendored or staged locally. Experimental remote imports may be used for discovery only.
5. Performance budgets are honored and visual/aesthetic consistency is maintained.
6. Feature gating, including experimental flags, is encouraged for all new capabilities.

---

### Preferred Domains

- Eleventy plugins, filters, shortcodes, data sources
- Tailwind official plugins and component libraries such as daisyUI and PrismJS themes
- Content pipelines, link checkers, remark/rehype integrations
- Build-time experiments behind feature flags
- Dev-only observability tools (build stats, reporters)

### Anti-Patterns (Unless Experimental)

- Replacing the core stack outside of an approved feature flag
- Permanent remote script imports at runtime

---

## 3. Decision Rubric (Before Adding or Upgrading)

1. Does this preserve the core build path or run behind an experimental flag?
2. Is it domain-appropriate or clearly marked experimental?
3. Is it documented in the agent knowledge base or decision log (flagged if one-off)?
4. Are performance and aesthetic budgets respected?
5. Has any experimental feature been toggled off and verified safe?
