# Continuation – Responsive Logo

## Context Recap

Hero logo now uses responsive classes and sizes instead of fixed dimensions.

## Outstanding Items

1. Add higher-density logo variants for large displays.
2. Investigate automatic size derivation.

## Execution Strategy

Refine branding data and plugin settings to expand breakpoint coverage.

## Trigger Command

NODE_OPTIONS=--import=./test/setup/http.mjs node --test
test/integration/logo-image.spec.mjs test/integration/homepage.spec.mjs
