# Markdown Anchors Test Report (2025-08-15 00:00:00)

- `node --test tests/markdown-anchor.spec.mjs` failed.
- Expected `<h2 id="section-heading">` but heading lacked `id` attribute.

```
not ok 1 - markdown headings include anchor ids
  error: The input did not match the regular expression /<h2 id="section-heading">Section Heading<\/h2>/.
```
