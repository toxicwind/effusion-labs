# Continuation: external-arrow

## Context Recap

External links now render with a prefixed `↗` and internal links use `⇢` symbol.

## Outstanding Items

1. Audit existing content for manually inserted `↗` to avoid duplicates.
2. Consider adding CSS-based arrow styling for external links to avoid text mutation.

## Execution Strategy

- Search content for `↗source` and adjust where necessary.
- Evaluate CSS approach for future consistency.

## Trigger Command

`npm run test:guard`
