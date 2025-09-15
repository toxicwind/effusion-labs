# Continuation – Homepage Logo

## Context Recap

Hero now displays a branded logo image loaded eagerly with centralized metadata.

## Outstanding Items

1. Expand hero logo coverage to secondary pages.
2. Assert alt text from branding data in tests.

## Execution Strategy

Extend integration tests and propagate branding data where needed.

## Trigger Command

NODE_OPTIONS=--import=./test/setup/http.mjs node --test
test/integration/homepage.spec.mjs
