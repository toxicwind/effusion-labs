# Shiki Migration Audit – 2025-08-20

## Summary
- Removed Prism-based syntax highlighting (`prismjs`, `prism-themes`, `@11ty/eleventy-plugin-syntaxhighlight`).
- Added Shiki stack (`shiki`, `@shikijs/transformers`, `@shikijs/markdown-it`).
- Replaced runtime Lucide icons with inline SVG macros for header navigation.

## Verification
- `npm ls prismjs` → package not found.
- `rg prism` shows no runtime references outside historical vendor docs.
- Build and tests pass with Shiki-generated code blocks.
