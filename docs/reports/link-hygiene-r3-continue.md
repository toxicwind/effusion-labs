
Run Plan

- **Scope:** Suppress spurious wikilink warnings, normalise tags, clean placeholders.
- **Steps:**
  1. Baseline build & capture warnings.
  2. Install tag-normaliser; add templated-link filter plugin.
  3. Exclude `src/test/**`; purge placeholder links.
  4. Re-run build; ensure zero `@photogabble/wikilinks` warnings.
- **Files:** `.eleventyignore`, `lib/templated-link-filter.js`, `lib/eleventy/templated-link-plugin.js`, `lib/plugins.js`, `package.json`, `package-lock.json`, `src/content/meta/style-guide.md`, `src/archives/collectables/designer-toys/pop-mart/the-monsters/index.njk`.
- **Artifacts:** `tmp/build.pre.graph.log`, `tmp/wikilink.pre.graph.log`, `tmp/build.post.graph.log`, `tmp/wikilink.post.graph.log`.
- **Gates:** Post-build log empty of wikilink warnings.
- **Rollback:** restore to prior commit using recorded SHA.

---
Context Recap: Baseline build produced templated-path and placeholder wikilink warnings. Implemented filtering and moved test archives to restore clean output.
Outstanding Items:
- Canonicalise analytic_lens, memory_ref, spark_type and target via Tag Atlas.
- Generate landing pages and badges for new taxonomies.
Execution Strategy: extend tag-normaliser configuration and Eleventy collections.
Trigger Command: npm run build

